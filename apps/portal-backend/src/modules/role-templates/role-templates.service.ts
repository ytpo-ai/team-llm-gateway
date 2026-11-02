import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRoleTemplateDto } from './dto/create-role-template.dto.js';
import { UpdateRoleTemplateDto } from './dto/update-role-template.dto.js';
import {
  RoleTemplate,
  RoleTemplateDocument,
} from './schemas/role-template.schema.js';

export interface RoleTemplateView {
  id: string;
  name: string;
  description: string;
  limitDaily: number | null;
  limitWeekly: number | null;
  limitMonthly: number | null;
  rateLimitPerMinute: number | null;
  providerIds: string[];
  modelWhitelist: string[];
  builtIn: boolean;
  createdAt?: Date;
}

const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  limitDaily: number | null;
  limitWeekly: number | null;
  limitMonthly: number | null;
  rateLimitPerMinute: number | null;
  providerIds: string[];
  modelWhitelist: string[];
}> = [
  {
    name: '设计师',
    description: '面向设计团队的默认配置，全部渠道可用',
    limitDaily: null,
    limitWeekly: null,
    limitMonthly: null,
    rateLimitPerMinute: null,
    providerIds: [],
    modelWhitelist: [],
  },
  {
    name: '开发人员',
    description: '面向开发团队的默认配置，全部渠道可用',
    limitDaily: null,
    limitWeekly: null,
    limitMonthly: null,
    rateLimitPerMinute: null,
    providerIds: [],
    modelWhitelist: [],
  },
];

@Injectable()
export class RoleTemplatesService {
  constructor(
    @InjectModel(RoleTemplate.name)
    private readonly roleTemplateModel: Model<RoleTemplate>,
  ) {}

  async ensureBuiltInTemplates(): Promise<void> {
    for (const template of BUILT_IN_TEMPLATES) {
      const existing = await this.roleTemplateModel
        .findOne({ builtIn: true, name: template.name })
        .exec();
      if (!existing) {
        await this.roleTemplateModel.create({
          tenantId: null,
          teamId: null,
          ...template,
          builtIn: true,
        });
      }
    }
  }

  async list(tenantId: string, teamId: string): Promise<RoleTemplateView[]> {
    const templates = await this.roleTemplateModel
      .find({
        $or: [
          { builtIn: true },
          { tenantId: new Types.ObjectId(tenantId), teamId: new Types.ObjectId(teamId) },
        ],
      })
      .sort({ builtIn: -1, createdAt: 1 })
      .exec();
    return templates.map((template) => this.toView(template));
  }

  async get(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<RoleTemplateView> {
    const template = await this.findAccessible(tenantId, teamId, id);
    return this.toView(template);
  }

  async create(
    tenantId: string,
    teamId: string,
    dto: CreateRoleTemplateDto,
  ): Promise<RoleTemplateView> {
    await this.assertNameAvailable(tenantId, teamId, dto.name);
    const template = await this.roleTemplateModel.create({
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
      name: dto.name,
      description: dto.description ?? '',
      limitDaily: dto.limitDaily ?? null,
      limitWeekly: dto.limitWeekly ?? null,
      limitMonthly: dto.limitMonthly ?? null,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
      providerIds: (dto.providerIds ?? []).map((id) => new Types.ObjectId(id)),
      modelWhitelist: dto.modelWhitelist ?? [],
      builtIn: false,
    });
    return this.toView(template);
  }

  async update(
    tenantId: string,
    teamId: string,
    id: string,
    dto: UpdateRoleTemplateDto,
  ): Promise<RoleTemplateView> {
    const template = await this.findAccessible(tenantId, teamId, id);

    if (dto.name !== undefined && dto.name !== template.name) {
      await this.assertNameAvailable(tenantId, teamId, dto.name);
      template.name = dto.name;
    }
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.limitDaily !== undefined) template.limitDaily = dto.limitDaily ?? null;
    if (dto.limitWeekly !== undefined) template.limitWeekly = dto.limitWeekly ?? null;
    if (dto.limitMonthly !== undefined) template.limitMonthly = dto.limitMonthly ?? null;
    if (dto.rateLimitPerMinute !== undefined) {
      template.rateLimitPerMinute = dto.rateLimitPerMinute ?? null;
    }
    if (dto.providerIds !== undefined) {
      template.providerIds = dto.providerIds.map((id) => new Types.ObjectId(id));
    }
    if (dto.modelWhitelist !== undefined) {
      template.modelWhitelist = dto.modelWhitelist;
    }

    await template.save();
    return this.toView(template);
  }

  async remove(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<RoleTemplateView> {
    const template = await this.findAccessible(tenantId, teamId, id);
    if (template.builtIn) {
      throw new ConflictException('内置角色模板不可删除');
    }
    await template.deleteOne();
    return this.toView(template);
  }

  async findById(id: string): Promise<RoleTemplateDocument | null> {
    return this.roleTemplateModel.findById(id).exec();
  }

  private async assertNameAvailable(
    tenantId: string,
    teamId: string,
    name: string,
  ): Promise<void> {
    const existing = await this.roleTemplateModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        name,
      })
      .exec();
    if (existing) {
      throw new ConflictException('角色模板名称已存在');
    }
  }

  private async findAccessible(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<RoleTemplateDocument> {
    const template = await this.roleTemplateModel
      .findOne({
        _id: id,
        $or: [
          { builtIn: true },
          { tenantId: new Types.ObjectId(tenantId), teamId: new Types.ObjectId(teamId) },
        ],
      })
      .exec();
    if (!template) {
      throw new NotFoundException('角色模板不存在');
    }
    return template;
  }

  private toView(template: RoleTemplateDocument): RoleTemplateView {
    return {
      id: String(template._id),
      name: template.name,
      description: template.description,
      limitDaily: template.limitDaily ?? null,
      limitWeekly: template.limitWeekly ?? null,
      limitMonthly: template.limitMonthly ?? null,
      rateLimitPerMinute: template.rateLimitPerMinute ?? null,
      providerIds: template.providerIds.map((id) => String(id)),
      modelWhitelist: template.modelWhitelist,
      builtIn: template.builtIn,
      createdAt: template.createdAt,
    };
  }
}
