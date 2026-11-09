import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { decrypt } from '../../common/crypto/cipher.js';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import type { ApiKeyDocument } from '../api-keys/schemas/api-key.schema.js';
import { BillingService } from '../billing/billing.service.js';
import { Team } from '../teams/schemas/team.schema.js';
import { User } from '../users/schemas/user.schema.js';
import {
  Model as ModelEntity,
  ModelDocument,
  ModelStatus,
  type ProviderBinding,
} from '../models/schemas/model.schema.js';
import {
  PolicyAction,
  PolicyMeasure,
  PolicySet,
  PolicySetDocument,
  PolicyWindow,
} from '../policy-sets/schemas/policy-set.schema.js';
import {
  Provider,
  ProviderDocument,
  ProviderStatus,
  ProviderType,
} from '../providers/schemas/provider.schema.js';
import {
  RoleTemplate,
  RoleTemplateDocument,
} from '../role-templates/schemas/role-template.schema.js';
import { ProviderUsageService } from '../usage/provider-usage.service.js';
import {
  Action,
  Candidate,
  Measure,
  StandardLimit,
  StandardPolicy,
  StandardState,
  Window,
} from './protocol/types.js';

/**
 * Converts policy-set-level enums to protocol-level enums.
 * These currently share the same string values but are intentionally
 * separate to keep protocol types free of Mongoose dependencies.
 */
function toMeasure(pm: PolicyMeasure): Measure {
  return pm as unknown as Measure;
}

function toWindow(pw: PolicyWindow): Window {
  return pw as unknown as Window;
}

function toAction(pa: PolicyAction): Action {
  return pa as unknown as Action;
}

function toCandidateType(pt: ProviderType): Candidate['type'] {
  return pt as unknown as Candidate['type'];
}

export interface PolicyResolverInput {
  tenantId: string;
  teamId: string;
  userId: string;
  apiKey: Pick<ApiKeyDocument, '_id' | 'status' | 'expiresAt' | 'policySetId'>;
  requestedModel: string;
}

export interface PolicyResolverOutput {
  policy: StandardPolicy;
  candidates: Candidate[];
}

@Injectable()
export class PolicyResolver {
  private readonly logger = new Logger(PolicyResolver.name);

  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RoleTemplate.name)
    private readonly roleTemplateModel: Model<RoleTemplate>,
    @InjectModel(PolicySet.name)
    private readonly policySetModel: Model<PolicySet>,
    @InjectModel(ModelEntity.name)
    private readonly modelModel: Model<ModelEntity>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    private readonly billingService: BillingService,
    private readonly providerUsageService: ProviderUsageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolve a full StandardPolicy + Candidate[] for the given request context.
   *
   * Throws if model cannot be found or is not allowed.
   */
  async resolve(input: PolicyResolverInput): Promise<PolicyResolverOutput> {
    const { tenantId, teamId, userId, apiKey } = input;

    // ── Load upstream data in parallel ──
    const [team, memberTemplate] = await Promise.all([
      this.teamModel.findById(teamId).exec(),
      this.resolveMemberTemplate(userId),
    ]);

    const [teamSet, roleSet, keySet] = await Promise.all([
      this.loadPolicySet(team?.policySetId),
      this.loadPolicySet(memberTemplate?.policySetId),
      this.loadPolicySet(apiKey.policySetId),
    ]);

    // ── Resolve model ──
    const model = await this.resolveModel(
      tenantId,
      teamId,
      input.requestedModel,
      { team: teamSet, role: roleSet, key: keySet },
    );

    // ── Evaluate balance ──
    const balance = await this.billingService.getSpendableBalance(
      tenantId,
      teamId,
      userId,
    );

    // ── Build states ──
    const states = this.buildStates(apiKey, model, balance);

    // ── Build allowlists ──
    const allowlists = this.buildAllowlists(teamSet, roleSet, keySet);

    // ── Build limits ──
    const limits = this.buildLimits(teamSet, roleSet, keySet);

    // ── Build policy ──
    const policy: StandardPolicy = {
      version: 1,
      subject: { tenantId, teamId, userId, apiKeyId: String(apiKey._id) },
      states,
      allowlists,
      limits,
    };

    // ── Build candidates ──
    const candidates = await this.buildCandidates(
      tenantId,
      teamId,
      model,
      { team: teamSet, role: roleSet, key: keySet },
    );

    return { policy, candidates };
  }

  // ── private helpers ──

  private async resolveMemberTemplate(
    userId: string,
  ): Promise<RoleTemplateDocument | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.roleTemplateId) return null;
    return this.roleTemplateModel.findById(user.roleTemplateId).exec();
  }

  private async loadPolicySet(
    id: Types.ObjectId | null | undefined,
  ): Promise<PolicySetDocument | null> {
    if (!id) return null;
    return this.policySetModel.findById(id).exec();
  }

  private async resolveModel(
    tenantId: string,
    teamId: string,
    requestedModel: string,
    resolved: { team: PolicySetDocument | null; role: PolicySetDocument | null; key: PolicySetDocument | null },
  ): Promise<ModelDocument> {
    const model = await this.modelModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        status: ModelStatus.ACTIVE,
        $or: [{ modelId: requestedModel }, { aliases: requestedModel }],
      })
      .exec();
    if (!model) {
      throw new NotFoundException(`模型不存在或已禁用：${requestedModel}`);
    }

    if (!this.isModelAllowed(resolved, model.modelId)) {
      throw new ForbiddenException('该 API Key 或成员角色不允许访问此模型');
    }

    return model;
  }

  private isModelAllowed(
    resolved: { team: PolicySetDocument | null; role: PolicySetDocument | null; key: PolicySetDocument | null },
    modelId: string,
  ): boolean {
    for (const set of [resolved.team, resolved.role, resolved.key]) {
      if (set?.modelWhitelist?.length && !set.modelWhitelist.includes(modelId)) {
        return false;
      }
    }
    return true;
  }

  private isProviderAllowed(
    resolved: { team: PolicySetDocument | null; role: PolicySetDocument | null; key: PolicySetDocument | null },
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

  private buildStates(
    apiKey: PolicyResolverInput['apiKey'],
    model: ModelDocument,
    balance: number,
  ): StandardState[] {
    const states: StandardState[] = [];

    // balance_ok
    states.push({
      name: 'balance_ok',
      ok: balance > 0,
      action: Action.BLOCK,
      code: 'BALANCE_INSUFFICIENT',
      message: balance <= 0 ? '额度余额不足' : undefined,
    });

    // key_active
    const keyOk = apiKey.status === ApiKeyStatus.ACTIVE &&
      (!apiKey.expiresAt || apiKey.expiresAt.getTime() > Date.now());
    states.push({
      name: 'key_active',
      ok: keyOk,
      action: Action.BLOCK,
      code: 'KEY_INACTIVE',
      message: !keyOk ? 'API Key 已吊销或已过期' : undefined,
    });

    // model_active
    const modelOk = model.status === ModelStatus.ACTIVE;
    states.push({
      name: 'model_active',
      ok: modelOk,
      action: Action.BLOCK,
      code: 'MODEL_DISABLED',
      message: !modelOk ? '模型已禁用' : undefined,
    });

    return states;
  }

  private buildAllowlists(
    teamSet: PolicySetDocument | null,
    roleSet: PolicySetDocument | null,
    keySet: PolicySetDocument | null,
  ): StandardPolicy['allowlists'] {
    const modelLists = [teamSet, roleSet, keySet]
      .filter((s): s is PolicySetDocument => s != null && (s.modelWhitelist?.length ?? 0) > 0)
      .map((s) => s.modelWhitelist);

    const providerLists = [teamSet, roleSet, keySet]
      .filter((s): s is PolicySetDocument => s != null && (s.providerIds?.length ?? 0) > 0)
      .map((s) => s.providerIds.map((id) => String(id)));

    return {
      model: modelLists.length > 0
        ? modelLists.reduce((a, b) => a.filter((v) => b.includes(v)))
        : null,
      provider: providerLists.length > 0
        ? providerLists.reduce((a, b) => a.filter((v) => b.includes(v)))
        : null,
    };
  }

  private buildLimits(
    teamSet: PolicySetDocument | null,
    roleSet: PolicySetDocument | null,
    keySet: PolicySetDocument | null,
  ): StandardLimit[] {
    const scopes: Array<{
      scope: StandardLimit['scope'];
      set: PolicySetDocument | null;
    }> = [
      { scope: 'team', set: teamSet },
      { scope: 'member', set: roleSet },
      { scope: 'key', set: keySet },
    ];

    const limits: StandardLimit[] = [];
    for (const { scope, set } of scopes) {
      if (!set) continue;
      for (const entry of set.entries ?? []) {
        if (!entry.limit || entry.limit <= 0) continue;
        limits.push({
          scope,
          measure: toMeasure(entry.measure),
          window: toWindow(entry.window),
          limit: entry.limit,
          action: toAction(entry.action),
        });
      }
    }
    return limits;
  }

  private async buildCandidates(
    tenantId: string,
    teamId: string,
    model: ModelDocument,
    resolved: { team: PolicySetDocument | null; role: PolicySetDocument | null; key: PolicySetDocument | null },
  ): Promise<Candidate[]> {
    const bindings: ProviderBinding[] =
      model.providerBindings && model.providerBindings.length > 0
        ? [...model.providerBindings]
        : [];

    // Ensure primary providerId is included (highest priority = 0)
    const primaryId = String(model.providerId);
    const hasPrimary = bindings.some(
      (b) => String(b.providerId) === primaryId,
    );
    if (!hasPrimary) {
      bindings.push({
        providerId: model.providerId,
        priority: 0,
      } as ProviderBinding);
    }

    bindings.sort((a, b) => a.priority - b.priority);

    // Convert all binding IDs for batch query
    const bindingIds = bindings.map((b) => String(b.providerId));
    const objectIds = bindingIds.map((id) => new Types.ObjectId(id));

    const providers = await this.providerModel
      .find({
        _id: { $in: objectIds },
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        status: ProviderStatus.ACTIVE,
      })
      .exec();

    const providerMap = new Map<string, ProviderDocument>(
      providers.map((p) => [String(p._id), p]),
    );

    const results: Candidate[] = [];
    for (const binding of bindings) {
      const providerId = String(binding.providerId);
      const provider = providerMap.get(providerId);
      if (!provider) continue;

      // Check provider whitelist
      if (!this.isProviderAllowed(resolved, providerId)) continue;

      // Check availability (rate-limit / circuit-breaker)
      const availability = await this.providerUsageService.getAvailability(
        tenantId,
        teamId,
        providerId,
      );
      if (!availability.available) {
        this.logger.debug(
          `Provider ${provider.name} unavailable (${availability.reason}), skipping`,
        );
        continue;
      }

      const upstreamKey = decrypt(
        this.encryptionSecret(),
        provider.apiKeyCiphertext,
      );

      results.push({
        providerId,
        priority: binding.priority,
        type: toCandidateType(provider.type),
        baseUrl: provider.baseUrl,
        apiKey: upstreamKey,
        authType: provider.authType,
        multiplier: model.multiplier,
      });
    }

    return results;
  }

  private encryptionSecret(): string {
    return this.configService.getOrThrow<string>('encryption.secret');
  }
}