import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { Provider } from '../providers/schemas/provider.schema.js';
import { User } from '../users/schemas/user.schema.js';
import {
  UsageGranularity,
  UsageQueryDto,
} from './dto/usage-query.dto.js';
import { UsageLogQueryDto } from './dto/usage-log-query.dto.js';
import {
  UsageLog,
  UsageLogDocument,
  UsageStatus,
} from './schemas/usage-log.schema.js';

export interface UsageRecordInput {
  tenantId: string;
  teamId: string;
  userId: string;
  apiKeyId: string;
  providerId: string;
  modelId: string;
  requestId: string;
  status: UsageStatus;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  multiplier: number;
  cost: number;
  scenario?: string | null;
  latencyMs?: number | null;
}

export interface UsageSummary {
  from: Date;
  to: Date;
  requestCount: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

export interface UsageTrendPoint {
  bucket: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface UsageBreakdownItem {
  id: string;
  label: string | null;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface UsageLogView {
  id: string;
  userId: string;
  apiKeyId: string;
  providerId: string;
  modelId: string;
  requestId: string;
  status: UsageStatus;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  multiplier: number;
  cost: number;
  latencyMs: number | null;
  createdAt?: Date;
}

export interface UsageLogPage {
  items: UsageLogView[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_RANGE_DAYS = 30;
const BREAKDOWN_LIMIT = 50;

interface AggregateRow {
  _id: unknown;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

@Injectable()
export class UsageService {
  constructor(
    @InjectModel(UsageLog.name)
    private readonly usageLogModel: Model<UsageLog>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  async record(input: UsageRecordInput): Promise<UsageLogDocument> {
    return this.usageLogModel.create({
      tenantId: new Types.ObjectId(input.tenantId),
      teamId: new Types.ObjectId(input.teamId),
      userId: new Types.ObjectId(input.userId),
      apiKeyId: new Types.ObjectId(input.apiKeyId),
      providerId: new Types.ObjectId(input.providerId),
      modelId: input.modelId,
      requestId: input.requestId,
      status: input.status,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      multiplier: input.multiplier,
      cost: input.cost,
      scenario: input.scenario ?? null,
      latencyMs: input.latencyMs ?? null,
    });
  }

  async sumTokensByApiKey(
    tenantId: string,
    apiKeyId: string,
  ): Promise<number> {
    const [result] = await this.usageLogModel
      .aggregate<{ total: number }>([
        {
          $match: {
            tenantId: new Types.ObjectId(tenantId),
            apiKeyId: new Types.ObjectId(apiKeyId),
          },
        },
        { $group: { _id: null, total: { $sum: '$totalTokens' } } },
      ])
      .exec();
    return result?.total ?? 0;
  }

  async sumTokens(filter: {
    tenantId: string;
    teamId?: string;
    userId?: string;
    apiKeyId?: string;
    since?: Date;
  }): Promise<number> {
    const [result] = await this.usageLogModel
      .aggregate<{ total: number }>([
        { $match: this.buildAggregateMatch(filter) },
        { $group: { _id: null, total: { $sum: '$totalTokens' } } },
      ])
      .exec();
    return result?.total ?? 0;
  }

  async sumCost(filter: {
    tenantId: string;
    teamId?: string;
    userId?: string;
    apiKeyId?: string;
    since?: Date;
  }): Promise<number> {
    const [result] = await this.usageLogModel
      .aggregate<{ total: number }>([
        { $match: this.buildAggregateMatch(filter) },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ])
      .exec();
    return result?.total ?? 0;
  }

  async countRequests(filter: {
    tenantId: string;
    teamId?: string;
    userId?: string;
    apiKeyId?: string;
    since?: Date;
  }): Promise<number> {
    return this.usageLogModel.countDocuments(this.buildAggregateMatch(filter)).exec();
  }

  private buildAggregateMatch(filter: {
    tenantId: string;
    teamId?: string;
    userId?: string;
    apiKeyId?: string;
    since?: Date;
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(filter.tenantId),
    };
    if (filter.teamId) match.teamId = new Types.ObjectId(filter.teamId);
    if (filter.userId) match.userId = new Types.ObjectId(filter.userId);
    if (filter.apiKeyId) match.apiKeyId = new Types.ObjectId(filter.apiKeyId);
    if (filter.since) match.createdAt = { $gte: filter.since };
    return match;
  }

  async summary(user: AuthUser, query: UsageQueryDto): Promise<UsageSummary> {
    const { from, to } = this.resolveRange(query);
    const match = this.buildMatch(user, from, to);

    const [result] = await this.usageLogModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            requestCount: { $sum: 1 },
            totalTokens: { $sum: '$totalTokens' },
            promptTokens: { $sum: '$promptTokens' },
            completionTokens: { $sum: '$completionTokens' },
            totalCost: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    return {
      from,
      to,
      requestCount: result?.requestCount ?? 0,
      totalTokens: result?.totalTokens ?? 0,
      promptTokens: result?.promptTokens ?? 0,
      completionTokens: result?.completionTokens ?? 0,
      totalCost: result?.totalCost ?? 0,
    };
  }

  async trends(
    user: AuthUser,
    query: UsageQueryDto,
  ): Promise<UsageTrendPoint[]> {
    const { from, to } = this.resolveRange(query);
    const match = this.buildMatch(user, from, to);
    const unit = query.granularity ?? UsageGranularity.DAY;

    const rows = await this.usageLogModel
      .aggregate<UsageTrendPoint & { _id: Date }>([
        { $match: match },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit, timezone: 'UTC' } },
            requestCount: { $sum: 1 },
            totalTokens: { $sum: '$totalTokens' },
            totalCost: { $sum: '$cost' },
          },
        },
        { $sort: { _id: 1 as const } },
      ])
      .exec();

    return rows.map((row) => ({
      bucket: row._id.toISOString(),
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));
  }

  async byModel(
    user: AuthUser,
    query: UsageQueryDto,
  ): Promise<UsageBreakdownItem[]> {
    const rows = await this.breakdown(user, query, '$modelId');
    return rows.map((row) => ({
      id: String(row._id),
      label: String(row._id),
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));
  }

  async byMember(
    user: AuthUser,
    query: UsageQueryDto,
  ): Promise<UsageBreakdownItem[]> {
    const rows = await this.breakdown(user, query, '$userId');
    const ids = rows.map((row) => String(row._id));

    const users = await this.userModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name email')
      .exec();
    const labelMap = new Map(
      users.map((u) => [String(u._id), u.name || u.email]),
    );

    return rows.map((row) => ({
      id: String(row._id),
      label: labelMap.get(String(row._id)) ?? String(row._id),
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));
  }

  async byKey(
    user: AuthUser,
    query: UsageQueryDto,
  ): Promise<UsageBreakdownItem[]> {
    const rows = await this.breakdown(user, query, '$apiKeyId');
    const ids = rows.map((row) => String(row._id));

    const keys = await this.apiKeyModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name keyPrefix')
      .exec();
    const labelMap = new Map(
      keys.map((k) => [String(k._id), k.name ?? k.keyPrefix]),
    );

    return rows.map((row) => ({
      id: String(row._id),
      label: labelMap.get(String(row._id)) ?? String(row._id),
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));
  }

  async byProvider(
    user: AuthUser,
    query: UsageQueryDto,
  ): Promise<UsageBreakdownItem[]> {
    const rows = await this.breakdown(user, query, '$providerId');
    const ids = rows.map((row) => String(row._id));

    const providers = await this.providerModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const labelMap = new Map(providers.map((p) => [String(p._id), p.name]));

    return rows.map((row) => ({
      id: String(row._id),
      label: labelMap.get(String(row._id)) ?? String(row._id),
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));
  }

  async listLogs(
    user: AuthUser,
    query: UsageLogQueryDto,
  ): Promise<UsageLogPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(user.tenantId),
    };
    if (user.teamId) {
      match.teamId = new Types.ObjectId(user.teamId);
    }
    if (user.role === Role.MEMBER) {
      match.userId = new Types.ObjectId(user.id);
    }

    const createdAt: Record<string, unknown> = {};
    if (query.from) createdAt.$gte = new Date(query.from);
    if (query.to) createdAt.$lte = new Date(query.to);
    if (Object.keys(createdAt).length > 0) match.createdAt = createdAt;

    if (query.userId) match.userId = new Types.ObjectId(query.userId);
    if (query.apiKeyId) match.apiKeyId = new Types.ObjectId(query.apiKeyId);
    if (query.modelId) match.modelId = query.modelId;
    if (query.status) match.status = query.status;

    const [docs, total] = await Promise.all([
      this.usageLogModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.usageLogModel.countDocuments(match).exec(),
    ]);

    return {
      items: docs.map((doc) => this.toLogView(doc)),
      total,
      page,
      pageSize,
    };
  }

  private toLogView(doc: UsageLogDocument): UsageLogView {
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      apiKeyId: String(doc.apiKeyId),
      providerId: String(doc.providerId),
      modelId: doc.modelId,
      requestId: doc.requestId,
      status: doc.status,
      promptTokens: doc.promptTokens,
      completionTokens: doc.completionTokens,
      totalTokens: doc.totalTokens,
      multiplier: doc.multiplier,
      cost: doc.cost,
      latencyMs: doc.latencyMs,
      createdAt: doc.createdAt,
    };
  }

  private async breakdown(
    user: AuthUser,
    query: UsageQueryDto,
    groupField: '$modelId' | '$userId' | '$apiKeyId' | '$providerId',
  ): Promise<AggregateRow[]> {
    const { from, to } = this.resolveRange(query);
    const match = this.buildMatch(user, from, to);

    const rows = await this.usageLogModel
      .aggregate<AggregateRow>([
        { $match: match },
        {
          $group: {
            _id: groupField,
            requestCount: { $sum: 1 },
            totalTokens: { $sum: '$totalTokens' },
            totalCost: { $sum: '$cost' },
          },
        },
        { $sort: { totalTokens: -1 as const } },
        { $limit: BREAKDOWN_LIMIT },
      ])
      .exec();

    return rows;
  }

  private resolveRange(query: UsageQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private buildMatch(
    user: AuthUser,
    from: Date,
    to: Date,
  ): Record<string, unknown> {
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(user.teamId),
      createdAt: { $gte: from, $lte: to },
    };

    if (user.role === Role.MEMBER) {
      match.userId = new Types.ObjectId(user.id);
    }

    return match;
  }
}
