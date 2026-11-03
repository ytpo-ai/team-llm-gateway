import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import {
  RoleTemplate,
  RoleTemplateDocument,
} from '../role-templates/schemas/role-template.schema.js';
import { Team, TeamDocument } from '../teams/schemas/team.schema.js';
import { User } from '../users/schemas/user.schema.js';

export interface ResolvedQuotaLimits {
  memberRateLimitPerMinute: number | null;
  keyRateLimitPerMinute: number | null;
  team: TeamDocument | null;
  memberTemplate: RoleTemplateDocument | null;
}

@Injectable()
export class QuotaLimitService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RoleTemplate.name)
    private readonly roleTemplateModel: Model<RoleTemplate>,
  ) {}

  async resolve(context: {
    teamId: string;
    userId: string;
    apiKey: ApiKey;
  }): Promise<ResolvedQuotaLimits> {
    const team = await this.teamModel.findById(context.teamId).exec();
    const memberTemplate = await this.resolveMemberTemplate(context.userId);

    return {
      memberRateLimitPerMinute: memberTemplate?.rateLimitPerMinute ?? null,
      keyRateLimitPerMinute: context.apiKey.rateLimitPerMinute ?? null,
      team,
      memberTemplate,
    };
  }

  async resolveMemberTemplate(
    userId: string,
  ): Promise<RoleTemplateDocument | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.roleTemplateId) return null;
    return this.roleTemplateModel.findById(user.roleTemplateId).exec();
  }

  isProviderAllowed(
    team: TeamDocument | null,
    memberTemplate: RoleTemplateDocument | null,
    apiKey: ApiKey,
    providerId: string,
  ): boolean {
    if (
      team?.providerIds?.length &&
      !team.providerIds.some((id) => String(id) === providerId)
    ) {
      return false;
    }
    if (
      memberTemplate?.providerIds?.length &&
      !memberTemplate.providerIds.some((id) => String(id) === providerId)
    ) {
      return false;
    }
    if (
      apiKey.providerIds?.length &&
      !apiKey.providerIds.some((id) => String(id) === providerId)
    ) {
      return false;
    }
    return true;
  }

  isModelAllowed(
    memberTemplate: RoleTemplateDocument | null,
    apiKey: ApiKey,
    modelId: string,
  ): boolean {
    if (
      memberTemplate?.modelWhitelist?.length &&
      !memberTemplate.modelWhitelist.includes(modelId)
    ) {
      return false;
    }
    if (
      apiKey.allowedModels?.length &&
      !apiKey.allowedModels.includes(modelId)
    ) {
      return false;
    }
    return true;
  }
}
