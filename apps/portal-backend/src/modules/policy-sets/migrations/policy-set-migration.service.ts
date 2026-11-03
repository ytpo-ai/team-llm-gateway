import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiKey } from '../../api-keys/schemas/api-key.schema.js';
import { RoleTemplate } from '../../role-templates/schemas/role-template.schema.js';
import { Team } from '../../teams/schemas/team.schema.js';
import {
  PolicyAction,
  PolicyEntry,
  PolicyMeasure,
  PolicySet,
  PolicyWindow,
} from '../schemas/policy-set.schema.js';

interface LegacyTeamDoc {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  limitDaily?: number | null;
  limitWeekly?: number | null;
  limitMonthly?: number | null;
  providerIds?: Types.ObjectId[];
}

interface LegacyRoleTemplateDoc {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  teamId?: Types.ObjectId | null;
  name?: string;
  builtIn?: boolean;
  limitDaily?: number | null;
  limitWeekly?: number | null;
  limitMonthly?: number | null;
  rateLimitPerMinute?: number | null;
  providerIds?: Types.ObjectId[];
  modelWhitelist?: string[];
}

interface LegacyApiKeyDoc {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  limitDaily?: number | null;
  limitWeekly?: number | null;
  limitMonthly?: number | null;
  rateLimitPerMinute?: number | null;
  maxTokens?: number | null;
  providerIds?: Types.ObjectId[];
  allowedModels?: string[];
}

interface BuiltInTemplateSeed {
  name: string;
  description: string;
}

const BUILT_IN_TEMPLATES: BuiltInTemplateSeed[] = [
  { name: '设计师', description: '面向设计团队的默认配置，全部渠道可用' },
  { name: '开发人员', description: '面向开发团队的默认配置，全部渠道可用' },
];

const TEAM_MIGRATION_NAME = '默认策略集';
const TEAM_MIGRATION_DESC = '由旧限额字段迁移生成';

function tokenEntry(
  window: PolicyWindow,
  limit: number,
): PolicyEntry {
  return {
    measure: PolicyMeasure.TOKEN,
    window,
    limit,
    action: PolicyAction.BLOCK,
  };
}

@Injectable()
export class PolicySetMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PolicySetMigrationService.name);

  constructor(
    @InjectModel(PolicySet.name)
    private readonly policySetModel: Model<PolicySet>,
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(RoleTemplate.name)
    private readonly roleTemplateModel: Model<RoleTemplate>,
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureBuiltIns();
    await this.migrateTeams();
    await this.migrateRoleTemplates();
    await this.migrateApiKeys();
    this.logger.log('策略集硬迁移完成');
  }

  private async ensureBuiltIns(): Promise<void> {
    for (const seed of BUILT_IN_TEMPLATES) {
      const template = await this.roleTemplateModel
        .findOne({ builtIn: true, name: seed.name })
        .exec();
      if (!template) {
        await this.roleTemplateModel.create({
          tenantId: null,
          teamId: null,
          name: seed.name,
          description: seed.description,
          policySetId: null,
          builtIn: true,
        });
      }

      let set = await this.policySetModel
        .findOne({ builtIn: true, name: seed.name })
        .exec();
      if (!set) {
        set = await this.policySetModel.create({
          tenantId: null,
          teamId: null,
          name: seed.name,
          description: seed.description,
          entries: [],
          providerIds: [],
          modelWhitelist: [],
          builtIn: true,
        });
      }

      await this.roleTemplateModel
        .updateOne({ builtIn: true, name: seed.name }, { policySetId: set._id })
        .exec();
    }
  }

  private async migrateTeams(): Promise<void> {
    const docs = (await this.teamModel.collection
      .find({})
      .toArray()) as unknown as LegacyTeamDoc[];

    for (const doc of docs) {
      const entries: PolicyEntry[] = [];
      if (doc.limitDaily != null) entries.push(tokenEntry(PolicyWindow.DAY, doc.limitDaily));
      if (doc.limitWeekly != null) entries.push(tokenEntry(PolicyWindow.WEEK, doc.limitWeekly));
      if (doc.limitMonthly != null) entries.push(tokenEntry(PolicyWindow.MONTH, doc.limitMonthly));
      const providerIds = (doc.providerIds ?? []).map((id) => new Types.ObjectId(id));

      if (entries.length > 0 || providerIds.length > 0) {
        const set = await this.policySetModel.create({
          tenantId: doc.tenantId ?? null,
          teamId: doc._id,
          name: TEAM_MIGRATION_NAME,
          description: TEAM_MIGRATION_DESC,
          entries,
          providerIds,
          modelWhitelist: [],
          builtIn: false,
        });
        await this.teamModel.collection.updateOne(
          { _id: doc._id },
          { $set: { policySetId: set._id } },
        );
      }

      await this.teamModel.collection.updateOne(
        { _id: doc._id },
        { $unset: { limitDaily: '', limitWeekly: '', limitMonthly: '', providerIds: '' } },
      );
    }
  }

  private async migrateRoleTemplates(): Promise<void> {
    const docs = (await this.roleTemplateModel.collection
      .find({ builtIn: { $ne: true } })
      .toArray()) as unknown as LegacyRoleTemplateDoc[];

    for (const doc of docs) {
      const entries: PolicyEntry[] = [];
      if (doc.limitDaily != null) entries.push(tokenEntry(PolicyWindow.DAY, doc.limitDaily));
      if (doc.limitWeekly != null) entries.push(tokenEntry(PolicyWindow.WEEK, doc.limitWeekly));
      if (doc.limitMonthly != null) entries.push(tokenEntry(PolicyWindow.MONTH, doc.limitMonthly));
      if (doc.rateLimitPerMinute != null) {
        entries.push({
          measure: PolicyMeasure.REQUEST,
          window: PolicyWindow.MINUTE,
          limit: doc.rateLimitPerMinute,
          action: PolicyAction.BLOCK,
        });
      }
      const providerIds = (doc.providerIds ?? []).map((id) => new Types.ObjectId(id));
      const modelWhitelist = doc.modelWhitelist ?? [];

      if (entries.length > 0 || providerIds.length > 0 || modelWhitelist.length > 0) {
        const set = await this.policySetModel.create({
          tenantId: doc.tenantId ?? null,
          teamId: doc.teamId ?? null,
          name: `${doc.name ?? '角色'}策略集`,
          description: TEAM_MIGRATION_DESC,
          entries,
          providerIds,
          modelWhitelist,
          builtIn: false,
        });
        await this.roleTemplateModel.collection.updateOne(
          { _id: doc._id },
          { $set: { policySetId: set._id } },
        );
      }

      await this.roleTemplateModel.collection.updateOne(
        { _id: doc._id },
        {
          $unset: {
            limitDaily: '',
            limitWeekly: '',
            limitMonthly: '',
            rateLimitPerMinute: '',
            providerIds: '',
            modelWhitelist: '',
          },
        },
      );
    }
  }

  private async migrateApiKeys(): Promise<void> {
    const docs = (await this.apiKeyModel.collection
      .find({})
      .toArray()) as unknown as LegacyApiKeyDoc[];

    for (const doc of docs) {
      const entries: PolicyEntry[] = [];
      if (doc.limitDaily != null) entries.push(tokenEntry(PolicyWindow.DAY, doc.limitDaily));
      if (doc.limitWeekly != null) entries.push(tokenEntry(PolicyWindow.WEEK, doc.limitWeekly));
      if (doc.limitMonthly != null) entries.push(tokenEntry(PolicyWindow.MONTH, doc.limitMonthly));
      if (doc.maxTokens != null) entries.push(tokenEntry(PolicyWindow.PERMANENT, doc.maxTokens));
      if (doc.rateLimitPerMinute != null) {
        entries.push({
          measure: PolicyMeasure.REQUEST,
          window: PolicyWindow.MINUTE,
          limit: doc.rateLimitPerMinute,
          action: PolicyAction.BLOCK,
        });
      }
      const providerIds = (doc.providerIds ?? []).map((id) => new Types.ObjectId(id));
      const modelWhitelist = doc.allowedModels ?? [];

      if (entries.length > 0 || providerIds.length > 0 || modelWhitelist.length > 0) {
        const set = await this.policySetModel.create({
          tenantId: doc.tenantId ?? null,
          teamId: doc.teamId ?? null,
          name: 'API Key 策略集',
          description: TEAM_MIGRATION_DESC,
          entries,
          providerIds,
          modelWhitelist,
          builtIn: false,
        });
        await this.apiKeyModel.collection.updateOne(
          { _id: doc._id },
          { $set: { policySetId: set._id } },
        );
      }

      await this.apiKeyModel.collection.updateOne(
        { _id: doc._id },
        {
          $unset: {
            limitDaily: '',
            limitWeekly: '',
            limitMonthly: '',
            rateLimitPerMinute: '',
            maxTokens: '',
            providerIds: '',
            allowedModels: '',
          },
        },
      );
    }
  }
}
