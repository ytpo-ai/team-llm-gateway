import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import {
  PolicyAction,
  PolicyEntry,
  PolicyMeasure,
  PolicySet,
  PolicySetDocument,
  PolicyWindow,
} from '../policy-sets/schemas/policy-set.schema.js';
import {
  RoleTemplate,
  RoleTemplateDocument,
} from '../role-templates/schemas/role-template.schema.js';
import { Team } from '../teams/schemas/team.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { UsageService } from '../usage/usage.service.js';

export interface ResolvedPolicyContext {
  team: PolicySetDocument | null;
  role: PolicySetDocument | null;
  key: PolicySetDocument | null;
}

export interface UsageSubject {
  tenantId: string;
  teamId: string;
  userId: string;
  apiKeyId: string;
}

interface ResolvedRateLimits {
  teamPerMinute: number | null;
  memberPerMinute: number | null;
  keyPerMinute: number | null;
  keyConcurrency: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfHour(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
}

function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeek(now: Date): Date {
  const day = startOfDay(now);
  const diff = ((day.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(day.getTime() - diff);
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function windowSince(window: PolicyWindow, now: Date): Date | null {
  switch (window) {
    case PolicyWindow.PERMANENT:
    case PolicyWindow.MINUTE:
      return null;
    case PolicyWindow.HOUR:
      return startOfHour(now);
    case PolicyWindow.DAY:
      return startOfDay(now);
    case PolicyWindow.WEEK:
      return startOfWeek(now);
    case PolicyWindow.MONTH:
      return startOfMonth(now);
    default:
      return null;
  }
}

const WINDOW_LABELS: Record<PolicyWindow, string> = {
  [PolicyWindow.PERMANENT]: '永久',
  [PolicyWindow.MINUTE]: '分钟',
  [PolicyWindow.HOUR]: '小时',
  [PolicyWindow.DAY]: '日',
  [PolicyWindow.WEEK]: '周',
  [PolicyWindow.MONTH]: '月',
};

const MEASURE_LABELS: Record<PolicyMeasure, string> = {
  [PolicyMeasure.TOKEN]: 'Token',
  [PolicyMeasure.REQUEST]: '请求',
  [PolicyMeasure.CONCURRENCY]: '并发',
  [PolicyMeasure.SPEND]: '消费',
};

function minBlockLimit(
  set: PolicySetDocument | null,
  measure: PolicyMeasure,
  window?: PolicyWindow,
): number | null {
  if (!set) return null;
  const entries = (set.entries ?? []).filter(
    (e) =>
      e.action === PolicyAction.BLOCK &&
      e.measure === measure &&
      (window === undefined || e.window === window) &&
      e.limit != null &&
      e.limit > 0,
  );
  if (entries.length === 0) return null;
  return Math.min(...entries.map((e) => e.limit));
}

@Injectable()
export class QuotaLimitService {
  private readonly logger = new Logger(QuotaLimitService.name);

  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RoleTemplate.name)
    private readonly roleTemplateModel: Model<RoleTemplate>,
    @InjectModel(PolicySet.name)
    private readonly policySetModel: Model<PolicySet>,
    private readonly usageService: UsageService,
  ) {}

  async resolve(context: {
    teamId: string;
    userId: string;
    apiKey: ApiKey;
  }): Promise<ResolvedPolicyContext> {
    const [team, memberTemplate] = await Promise.all([
      this.teamModel.findById(context.teamId).exec(),
      this.resolveMemberTemplate(context.userId),
    ]);

    const [teamSet, roleSet, keySet] = await Promise.all([
      this.loadPolicySet(team?.policySetId),
      this.loadPolicySet(memberTemplate?.policySetId),
      this.loadPolicySet(context.apiKey.policySetId),
    ]);

    return {
      team: teamSet,
      role: roleSet,
      key: keySet,
    };
  }

  private async loadPolicySet(
    id: Types.ObjectId | null | undefined,
  ): Promise<PolicySetDocument | null> {
    if (!id) return null;
    return this.policySetModel.findById(id).exec();
  }

  async resolveMemberTemplate(
    userId: string,
  ): Promise<RoleTemplateDocument | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.roleTemplateId) return null;
    return this.roleTemplateModel.findById(user.roleTemplateId).exec();
  }

  isProviderAllowed(
    resolved: ResolvedPolicyContext,
    providerId: string,
  ): boolean {
    for (const set of [resolved.team, resolved.role, resolved.key]) {
      if (
        set?.providerIds?.length &&
        !set.providerIds.some((id) => String(id) === providerId)
      ) {
        return false;
      }
    }
    return true;
  }

  isModelAllowed(resolved: ResolvedPolicyContext, modelId: string): boolean {
    for (const set of [resolved.team, resolved.role, resolved.key]) {
      if (set?.modelWhitelist?.length && !set.modelWhitelist.includes(modelId)) {
        return false;
      }
    }
    return true;
  }

  resolveRateLimits(resolved: ResolvedPolicyContext): ResolvedRateLimits {
    return {
      teamPerMinute: minBlockLimit(
        resolved.team,
        PolicyMeasure.REQUEST,
        PolicyWindow.MINUTE,
      ),
      memberPerMinute: minBlockLimit(
        resolved.role,
        PolicyMeasure.REQUEST,
        PolicyWindow.MINUTE,
      ),
      keyPerMinute: minBlockLimit(
        resolved.key,
        PolicyMeasure.REQUEST,
        PolicyWindow.MINUTE,
      ),
      keyConcurrency: minBlockLimit(resolved.key, PolicyMeasure.CONCURRENCY),
    };
  }

  async assertUsageLimits(
    resolved: ResolvedPolicyContext,
    subject: UsageSubject,
  ): Promise<void> {
    const scopes: Array<{
      label: string;
      name: 'team' | 'role' | 'key';
      set: PolicySetDocument | null;
    }> = [
      { label: '团队', name: 'team', set: resolved.team },
      { label: '成员', name: 'role', set: resolved.role },
      { label: 'API Key', name: 'key', set: resolved.key },
    ];

    const usedCache = new Map<string, number>();

    for (const scope of scopes) {
      if (!scope.set) continue;
      for (const entry of scope.set.entries ?? []) {
        if (!entry.limit || entry.limit <= 0) continue;
        if (entry.measure === PolicyMeasure.CONCURRENCY) continue;
        if (
          entry.measure === PolicyMeasure.REQUEST &&
          entry.window === PolicyWindow.MINUTE
        ) {
          continue;
        }

        const cacheKey = `${scope.name}:${entry.measure}:${entry.window}`;
        let used = usedCache.get(cacheKey);
        if (used === undefined) {
          used = await this.aggregateUsage(scope.name, entry, subject);
          usedCache.set(cacheKey, used);
        }

        if (used < entry.limit) continue;

        const measureLabel = MEASURE_LABELS[entry.measure];
        const windowLabel = WINDOW_LABELS[entry.window];
        const message = `${scope.label}${windowLabel}${measureLabel}限额已用尽（${used} / ${entry.limit}）`;

        if (entry.action === PolicyAction.BLOCK) {
          throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
        }
        this.logger.warn(`策略预警（warn）：${message}`);
      }
    }
  }

  private async aggregateUsage(
    scopeName: 'team' | 'role' | 'key',
    entry: PolicyEntry,
    subject: UsageSubject,
  ): Promise<number> {
    const filter: {
      tenantId: string;
      teamId?: string;
      userId?: string;
      apiKeyId?: string;
      since?: Date;
    } = { tenantId: subject.tenantId };

    if (scopeName === 'team') filter.teamId = subject.teamId;
    else if (scopeName === 'role') filter.userId = subject.userId;
    else filter.apiKeyId = subject.apiKeyId;

    const since = windowSince(entry.window, new Date());
    if (since) filter.since = since;

    switch (entry.measure) {
      case PolicyMeasure.TOKEN:
        return this.usageService.sumTokens(filter);
      case PolicyMeasure.SPEND:
        return this.usageService.sumCost(filter);
      case PolicyMeasure.REQUEST:
        return this.usageService.countRequests(filter);
      default:
        return 0;
    }
  }
}
