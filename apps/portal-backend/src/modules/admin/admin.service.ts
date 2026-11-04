import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import { Team, TeamStatus } from '../teams/schemas/team.schema.js';
import { DEFAULT_TEAM_NAME } from '../teams/teams.service.js';
import {
  Tenant,
  TenantDocument,
  TenantStatus,
} from '../tenant/schemas/tenant.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { UsageLog } from '../usage/schemas/usage-log.schema.js';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto.js';
import { OverviewQueryDto } from './dto/overview-query.dto.js';

export interface TenantView {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  teamCount: number;
  memberCount: number;
  apiKeyCount: number;
  createdAt?: Date;
}

export interface TenantDetailView extends TenantView {
  config: Record<string, unknown>;
}

export interface AdminOverview {
  from: Date;
  to: Date;
  tenantCount: number;
  teamCount: number;
  memberCount: number;
  apiKeyCount: number;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface TenantUsageItem {
  tenantId: string;
  name: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface UsageAggregateRow {
  _id: Types.ObjectId | null;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
    @InjectModel(UsageLog.name)
    private readonly usageLogModel: Model<UsageLog>,
  ) {}

  async listTenants(
    query: ListTenantsQueryDto,
  ): Promise<{
    items: TenantView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const filter = this.buildTenantFilter(query);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [docs, total] = await Promise.all([
      this.tenantModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.tenantModel.countDocuments(filter).exec(),
    ]);

    const items = await Promise.all(docs.map((doc) => this.toTenantView(doc)));
    return { items, total, limit, offset };
  }

  async getTenant(id: string): Promise<TenantDetailView> {
    const tenant = await this.findTenant(id);
    const view = await this.toTenantView(tenant);
    return { ...view, config: tenant.config ?? {} };
  }

  async listAllTeams(): Promise<
    { id: string; name: string; tenantId: string; status: TeamStatus }[]
  > {
    const teams = await this.teamModel.find({}).sort({ createdAt: 1 }).exec();
    return teams.map((team) => ({
      id: String(team._id),
      name: team.name,
      tenantId: String(team.tenantId),
      status: team.status,
    }));
  }

  async createTenant(code: string, name: string): Promise<TenantView> {
    const existing = await this.tenantModel.findOne({ code }).exec();
    if (existing) {
      throw new ConflictException('租户编码已存在');
    }
    const tenant = await this.tenantModel.create({ code, name });
    await this.teamModel.create({
      tenantId: tenant._id,
      name: DEFAULT_TEAM_NAME,
    });
    return this.toTenantView(tenant);
  }

  async updateTenantStatus(
    id: string,
    status: TenantStatus,
  ): Promise<TenantView> {
    const tenant = await this.findTenant(id);
    tenant.status = status;
    await tenant.save();
    return this.toTenantView(tenant);
  }

  async overview(query: OverviewQueryDto): Promise<AdminOverview> {
    const { from, to } = this.resolveRange(query);

    const [tenantCount, teamCount, memberCount, apiKeyCount, usage] =
      await Promise.all([
        this.tenantModel.countDocuments().exec(),
        this.teamModel.countDocuments().exec(),
        this.userModel.countDocuments({ role: { $ne: Role.SYSTEM } }).exec(),
        this.apiKeyModel.countDocuments().exec(),
        this.aggregateUsage(from, to),
      ]);

    return {
      from,
      to,
      tenantCount,
      teamCount,
      memberCount,
      apiKeyCount,
      requestCount: usage.requestCount,
      totalTokens: usage.totalTokens,
      totalCost: usage.totalCost,
    };
  }

  async usageBreakdown(
    query: OverviewQueryDto,
  ): Promise<{ from: Date; to: Date; items: TenantUsageItem[] }> {
    const { from, to } = this.resolveRange(query);

    const rows = await this.usageLogModel
      .aggregate<UsageAggregateRow>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$tenantId',
            requestCount: { $sum: 1 },
            totalTokens: { $sum: '$totalTokens' },
            totalCost: { $sum: '$cost' },
          },
        },
        { $sort: { totalTokens: -1 as const } },
      ])
      .exec();

    const tenantIds = rows
      .map((row) => row._id)
      .filter((id): id is Types.ObjectId => id !== null);
    const tenants = await this.tenantModel
      .find({ _id: { $in: tenantIds } })
      .select('name')
      .exec();
    const nameMap = new Map(tenants.map((t) => [String(t._id), t.name]));

    const items = rows.map((row) => ({
      tenantId: row._id ? String(row._id) : '',
      name: row._id ? (nameMap.get(String(row._id)) ?? String(row._id)) : '',
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));

    return { from, to, items };
  }

  private async aggregateUsage(
    from: Date,
    to: Date,
  ): Promise<{
    requestCount: number;
    totalTokens: number;
    totalCost: number;
  }> {
    const [result] = await this.usageLogModel
      .aggregate<{
        requestCount: number;
        totalTokens: number;
        totalCost: number;
      }>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            requestCount: { $sum: 1 },
            totalTokens: { $sum: '$totalTokens' },
            totalCost: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    return {
      requestCount: result?.requestCount ?? 0,
      totalTokens: result?.totalTokens ?? 0,
      totalCost: result?.totalCost ?? 0,
    };
  }

  private buildTenantFilter(
    query: ListTenantsQueryDto,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      const escaped = query.search.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ code: regex }, { name: regex }];
    }
    return filter;
  }

  private async findTenant(id: string): Promise<TenantDocument> {
    const tenant = await this.tenantModel.findById(id).exec();
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
    return tenant;
  }

  private async toTenantView(tenant: TenantDocument): Promise<TenantView> {
    const tenantId = tenant._id as Types.ObjectId;
    const [teamCount, memberCount, apiKeyCount] = await Promise.all([
      this.teamModel.countDocuments({ tenantId }).exec(),
      this.userModel
        .countDocuments({ tenantId, role: { $ne: Role.SYSTEM } })
        .exec(),
      this.apiKeyModel.countDocuments({ tenantId }).exec(),
    ]);
    return {
      id: String(tenant._id),
      code: tenant.code,
      name: tenant.name,
      status: tenant.status,
      teamCount,
      memberCount,
      apiKeyCount,
      createdAt: tenant.createdAt,
    };
  }

  private resolveRange(query: OverviewQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}
