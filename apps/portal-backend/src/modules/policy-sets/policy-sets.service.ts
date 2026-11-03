import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePolicySetDto } from './dto/create-policy-set.dto.js';
import { UpdatePolicySetDto } from './dto/update-policy-set.dto.js';
import {
  PolicyEntry,
  PolicySet,
  PolicySetDocument,
} from './schemas/policy-set.schema.js';

export interface PolicyEntryView {
  measure: string;
  window: string;
  limit: number;
  action: string;
}

export interface PolicySetView {
  id: string;
  name: string;
  description: string;
  entries: PolicyEntryView[];
  providerIds: string[];
  modelWhitelist: string[];
  builtIn: boolean;
  createdAt?: Date;
}

@Injectable()
export class PolicySetsService {
  constructor(
    @InjectModel(PolicySet.name)
    private readonly policySetModel: Model<PolicySet>,
  ) {}

  async list(tenantId: string, teamId: string): Promise<PolicySetView[]> {
    const sets = await this.policySetModel
      .find({
        $or: [
          { builtIn: true },
          {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
          },
        ],
      })
      .sort({ builtIn: -1, createdAt: 1 })
      .exec();
    return sets.map((set) => this.toView(set));
  }

  async get(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<PolicySetView> {
    const set = await this.findAccessible(tenantId, teamId, id);
    return this.toView(set);
  }

  async create(
    tenantId: string,
    teamId: string,
    dto: CreatePolicySetDto,
  ): Promise<PolicySetView> {
    await this.assertNameAvailable(tenantId, teamId, dto.name);
    const entries = this.normalizeEntries(dto.entries ?? []);
    const set = await this.policySetModel.create({
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
      name: dto.name,
      description: dto.description ?? '',
      entries,
      providerIds: (dto.providerIds ?? []).map((id) => new Types.ObjectId(id)),
      modelWhitelist: dto.modelWhitelist ?? [],
      builtIn: false,
    });
    return this.toView(set);
  }

  async update(
    tenantId: string,
    teamId: string,
    id: string,
    dto: UpdatePolicySetDto,
  ): Promise<PolicySetView> {
    const set = await this.findAccessible(tenantId, teamId, id);

    if (dto.name !== undefined && dto.name !== set.name) {
      await this.assertNameAvailable(tenantId, teamId, dto.name);
      set.name = dto.name;
    }
    if (dto.description !== undefined) set.description = dto.description;
    if (dto.entries !== undefined) {
      set.entries = this.normalizeEntries(dto.entries) as PolicySet['entries'];
    }
    if (dto.providerIds !== undefined) {
      set.providerIds = dto.providerIds.map((id) => new Types.ObjectId(id));
    }
    if (dto.modelWhitelist !== undefined) {
      set.modelWhitelist = dto.modelWhitelist;
    }

    await set.save();
    return this.toView(set);
  }

  async remove(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<PolicySetView> {
    const set = await this.findAccessible(tenantId, teamId, id);
    if (set.builtIn) {
      throw new ConflictException('内置策略集不可删除');
    }
    await set.deleteOne();
    return this.toView(set);
  }

  async findById(id: string): Promise<PolicySetDocument | null> {
    return this.policySetModel.findById(id).exec();
  }

  private normalizeEntries(entries: PolicyEntry[]): PolicyEntry[] {
    const seen = new Set<string>();
    const normalized: PolicyEntry[] = [];
    for (const entry of entries) {
      const key = `${entry.measure}:${entry.window}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `策略条目存在重复的「计量维度 + 时间窗口」：${entry.measure} × ${entry.window}`,
        );
      }
      seen.add(key);
      normalized.push({
        measure: entry.measure,
        window: entry.window,
        limit: entry.limit,
        action: entry.action,
      });
    }
    return normalized;
  }

  private async assertNameAvailable(
    tenantId: string,
    teamId: string,
    name: string,
  ): Promise<void> {
    const existing = await this.policySetModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        name,
      })
      .exec();
    if (existing) {
      throw new ConflictException('策略集名称已存在');
    }
  }

  private async findAccessible(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<PolicySetDocument> {
    const set = await this.policySetModel
      .findOne({
        _id: id,
        $or: [
          { builtIn: true },
          {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
          },
        ],
      })
      .exec();
    if (!set) {
      throw new NotFoundException('策略集不存在');
    }
    return set;
  }

  private toView(set: PolicySetDocument): PolicySetView {
    return {
      id: String(set._id),
      name: set.name,
      description: set.description,
      entries: (set.entries ?? []).map((entry) => ({
        measure: entry.measure,
        window: entry.window,
        limit: entry.limit,
        action: entry.action,
      })),
      providerIds: (set.providerIds ?? []).map((id) => String(id)),
      modelWhitelist: set.modelWhitelist ?? [],
      builtIn: set.builtIn,
      createdAt: set.createdAt,
    };
  }
}
