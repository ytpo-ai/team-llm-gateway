import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
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
  lastUsedAt: Date | null;
  userId: string;
  createdAt?: Date;
}

const KEY_PREFIX = 'pk_';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
  ) {}

  async create(
    user: AuthUser,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    return this.persistKey(user, dto);
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
    return keys.map((key) => this.toView(key));
  }

  async get(user: AuthUser, id: string): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);
    return this.toView(key);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateApiKeyDto,
  ): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);

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

    await key.save();
    return this.toView(key);
  }

  async revoke(user: AuthUser, id: string): Promise<ApiKeyView> {
    const key = await this.findAccessibleKey(user, id);
    key.status = ApiKeyStatus.REVOKED;
    await key.save();
    return this.toView(key);
  }

  async rotate(
    user: AuthUser,
    id: string,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const old = await this.findAccessibleKey(user, id);
    old.status = ApiKeyStatus.REVOKED;
    await old.save();

    return this.persistKey(user, {
      name: old.name ?? undefined,
      expiresAt: old.expiresAt?.toISOString(),
      allowedModels: old.allowedModels,
      rateLimitPerMinute: old.rateLimitPerMinute ?? undefined,
      maxTokens: old.maxTokens ?? undefined,
    });
  }

  private async persistKey(
    user: AuthUser,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const key = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    const doc = await this.apiKeyModel.create({
      tenantId: user.tenantId,
      teamId: user.teamId,
      userId: user.id,
      name: dto.name ?? null,
      keyHash,
      keyPrefix: key.slice(0, 12),
      status: ApiKeyStatus.ACTIVE,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      allowedModels: dto.allowedModels ?? [],
      rateLimitPerMinute: dto.rateLimitPerMinute ?? null,
      maxTokens: dto.maxTokens ?? null,
    });

    return { apiKey: this.toView(doc), key };
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

  private toView(key: ApiKeyDocument): ApiKeyView {
    return {
      id: String(key._id),
      name: key.name,
      keyPrefix: key.keyPrefix,
      status: key.status,
      expiresAt: key.expiresAt,
      allowedModels: key.allowedModels,
      rateLimitPerMinute: key.rateLimitPerMinute,
      maxTokens: key.maxTokens,
      lastUsedAt: key.lastUsedAt,
      userId: String(key.userId),
      createdAt: key.createdAt,
    };
  }
}
