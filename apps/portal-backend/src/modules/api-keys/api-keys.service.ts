import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';
import {
  ApiKey,
  ApiKeyDocument,
  ApiKeyStatus,
} from './schemas/api-key.schema.js';

export interface ApiKeyView {
  id: string;
  name: string | null;
  keyPrefix: string;
  status: ApiKeyStatus;
  expiresAt: Date | null;
  allowedModels: string[];
  rateLimitPerMinute: number | null;
  maxTokens: number | null;
  limitDaily: number | null;
  limitWeekly: number | null;
  limitMonthly: number | null;
  providerIds: string[];
  lastUsedAt: Date | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  createdAt?: Date;
}

interface UserBrief {
  name: string | null;
  email: string | null;
}

const KEY_PREFIX = 'pk_';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    user: AuthUser,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const targetUserId = await this.resolveTargetUserId(user, dto.userId);
    return this.persistKey(user, dto, targetUserId);
  }

  async list(user: AuthUser, userIdFilter?: string): Promise<ApiKeyView[]> {
    const filter =
      user.role === Role.TEAM_ADMIN
        ? { tenantId: user.tenantId, teamId: user.teamId }
        : { tenantId: user.tenantId, userId: user.id };

    if (user.role === Role.TEAM_ADMIN && userIdFilter) {
      filter.userId = userIdFilter;
    }

    const keys = await this.apiKeyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    const briefMap = await this.buildUserBriefMap(
      keys.map((key) => String(key.userId)),
    );

    return keys.map((key) => this.toView(key, briefMap.get(String(key.userId))));
  }

  async get(user: AuthUser, id: string): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);
    const brief = await this.resolveUserBrief(String(key.userId));
    return this.toView(key, brief);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateApiKeyDto,
  ): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);

    if (dto.userId !== undefined) {
      const targetUserId = await this.resolveTargetUserId(user, dto.userId);
      key.userId = new Types.ObjectId(targetUserId);
    }
    if (dto.name !== undefined) key.name = dto.name ?? null;
    if (dto.expiresAt !== undefined) {
      key.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.allowedModels !== undefined) {
      key.allowedModels = dto.allowedModels ?? [];
    }
    if (dto.rateLimitPerMinute !== undefined) {
      key.rateLimitPerMinute = dto.rateLimitPerMinute ?? null;
    }
    if (dto.maxTokens !== undefined) {
      key.maxTokens = dto.maxTokens ?? null;
    }
    if (dto.limitDaily !== undefined) {
      key.limitDaily = dto.limitDaily ?? null;
    }
    if (dto.limitWeekly !== undefined) {
      key.limitWeekly = dto.limitWeekly ?? null;
    }
    if (dto.limitMonthly !== undefined) {
      key.limitMonthly = dto.limitMonthly ?? null;
    }
    if (dto.providerIds !== undefined) {
      key.providerIds = (dto.providerIds ?? []).map(
        (id) => new Types.ObjectId(id),
      );
    }

    await key.save();
    const brief = await this.resolveUserBrief(String(key.userId));
    return this.toView(key, brief);
  }

  async revoke(user: AuthUser, id: string): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);
    key.status = ApiKeyStatus.REVOKED;
    await key.save();
    const brief = await this.resolveUserBrief(String(key.userId));
    return this.toView(key, brief);
  }

  async rotate(
    user: AuthUser,
    id: string,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const old = await this.findAccessibleKey(user, id);
    old.status = ApiKeyStatus.REVOKED;
    await old.save();

    return this.persistKey(
      user,
      {
        name: old.name ?? undefined,
        expiresAt: old.expiresAt?.toISOString(),
        allowedModels: old.allowedModels,
        rateLimitPerMinute: old.rateLimitPerMinute ?? undefined,
        maxTokens: old.maxTokens ?? undefined,
        limitDaily: old.limitDaily ?? undefined,
        limitWeekly: old.limitWeekly ?? undefined,
        limitMonthly: old.limitMonthly ?? undefined,
        providerIds: old.providerIds.map((id) => String(id)),
      },
      String(old.userId),
    );
  }

  private async persistKey(
    user: AuthUser,
    dto: CreateApiKeyDto,
    targetUserId: string,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const key = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    const doc = await this.apiKeyModel.create({
      tenantId: user.tenantId,
      teamId: user.teamId,
      userId: targetUserId,
      name: dto.name ?? null,
      keyHash,
      keyPrefix: key.slice(0, 12),
      status: ApiKeyStatus.ACTIVE,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      allowedModels: dto.allowedModels ?? [],
      rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
      maxTokens: dto.maxTokens ?? null,
      limitDaily: dto.limitDaily ?? null,
      limitWeekly: dto.limitWeekly ?? null,
      limitMonthly: dto.limitMonthly ?? null,
      providerIds: (dto.providerIds ?? []).map((id) => new Types.ObjectId(id)),
    });

    const brief = await this.resolveUserBrief(targetUserId);
    return { apiKey: this.toView(doc, brief), key };
  }

  private async resolveTargetUserId(
    user: AuthUser,
    userId?: string,
  ): Promise<string> {
    if (!userId) {
      return user.id;
    }
    if (user.role === Role.MEMBER && userId !== user.id) {
      throw new ForbiddenException('普通成员仅能绑定自己的 API Key');
    }

    const target = await this.usersService.findById(userId);
    if (!target || String(target.tenantId) !== user.tenantId) {
      throw new NotFoundException('目标成员不存在');
    }
    if (
      user.teamId != null &&
      (!target.teamId || String(target.teamId) !== user.teamId)
    ) {
      throw new NotFoundException('目标成员不属于当前团队');
    }
    return String(target._id);
  }

  private async findAccessibleKey(
    user: AuthUser,
    id: string,
  ): Promise<ApiKeyDocument> {
    const key = await this.apiKeyModel
      .findOne({ _id: id, tenantId: user.tenantId })
      .exec();
    if (!key) {
      throw new NotFoundException('API Key 不存在');
    }

    const isOwner = String(key.userId) === user.id;
    const isTeamAdmin =
      user.role === Role.TEAM_ADMIN && String(key.teamId) === user.teamId;
    if (!isOwner && !isTeamAdmin) {
      throw new ForbiddenException('无权操作该 API Key');
    }

    return key;
  }

  private async buildUserBriefMap(
    userIds: string[],
  ): Promise<Map<string, UserBrief>> {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.usersService.findByIds(uniqueIds);
    return new Map(
      users.map((u) => [
        String(u._id),
        { name: u.name ?? null, email: u.email ?? null },
      ]),
    );
  }

  private async resolveUserBrief(userId: string): Promise<UserBrief> {
    const user = await this.usersService.findById(userId);
    return { name: user?.name ?? null, email: user?.email ?? null };
  }

  private toView(key: ApiKeyDocument, brief?: UserBrief): ApiKeyView {
    return {
      id: String(key._id),
      name: key.name,
      keyPrefix: key.keyPrefix,
      status: key.status,
      expiresAt: key.expiresAt,
      allowedModels: key.allowedModels,
      rateLimitPerMinute: key.rateLimitPerMinute,
      maxTokens: key.maxTokens,
      limitDaily: key.limitDaily ?? null,
      limitWeekly: key.limitWeekly ?? null,
      limitMonthly: key.limitMonthly ?? null,
      providerIds: key.providerIds?.map((id) => String(id)) ?? [],
      lastUsedAt: key.lastUsedAt,
      userId: String(key.userId),
      userName: brief?.name ?? null,
      userEmail: brief?.email ?? null,
      createdAt: key.createdAt,
    };
  }
}
