import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { Model, Types } from 'mongoose';
import { decrypt } from '../../common/crypto/cipher.js';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import { Model as ModelEntity, ModelStatus } from '../models/schemas/model.schema.js';
import {
  Provider,
  ProviderStatus,
  ProviderType,
} from '../providers/schemas/provider.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';

interface ChatCompletionsBody {
  model?: unknown;
  stream?: unknown;
  stream_options?: unknown;
  [key: string]: unknown;
}

interface UpstreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface PreparedRequest {
  modelId: string;
  providerId: string;
  multiplier: number;
  url: string;
  upstreamKey: string;
  upstreamBody: Record<string, unknown>;
  requestId: string;
  startedAt: number;
}

@Injectable()
export class ProxyService {
  constructor(
    @InjectModel(ModelEntity.name)
    private readonly modelModel: Model<ModelEntity>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
    private readonly configService: ConfigService,
    private readonly usageService: UsageService,
  ) {}

  async listModels(ctx: ApiKeyContext) {
    const models = await this.modelModel
      .find({
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ModelStatus.ACTIVE,
      })
      .sort({ createdAt: -1 })
      .exec();

    const allowed = ctx.apiKey.allowedModels ?? [];
    const visible = allowed.length > 0
      ? models.filter((m) => allowed.includes(m.modelId))
      : models;

    return {
      object: 'list',
      data: visible.map((m) => ({
        id: m.modelId,
        object: 'model',
        created: m.createdAt ? Math.floor(m.createdAt.getTime() / 1000) : 0,
        owned_by: 'portal',
      })),
    };
  }

  async chatCompletions(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    res: ExpressResponse,
  ): Promise<unknown> {
    const prepared = await this.prepare(ctx, body);

    const upstreamRes = await this.requestUpstream(prepared);
    const text = await upstreamRes.text();
    const json = this.tryParseJson(text);

    if (upstreamRes.ok) {
      await this.recordUsage(ctx, prepared, (json as { usage?: UpstreamUsage })?.usage);
    } else {
      await this.recordError(ctx, prepared, upstreamRes.status);
    }

    res.status(upstreamRes.status);
    return json;
  }

  async streamChatCompletions(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    res: ExpressResponse,
  ): Promise<void> {
    const prepared = await this.prepare(ctx, body);

    const upstreamRes = await this.requestUpstream(prepared);
    if (!upstreamRes.ok || !upstreamRes.body) {
      const text = await upstreamRes.text();
      await this.recordError(ctx, prepared, upstreamRes.status);
      res.status(upstreamRes.status).json(this.tryParseJson(text));
      return;
    }

    res.status(200);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let usage: UpstreamUsage | undefined;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        sseBuffer = `${sseBuffer}${chunk}`.slice(-8192);
        usage = this.extractUsage(sseBuffer) ?? usage;
      }
    } finally {
      res.end();
      await this.recordUsage(ctx, prepared, usage);
    }
  }

  private async prepare(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
  ): Promise<PreparedRequest> {
    const requestedModel = body.model;
    if (typeof requestedModel !== 'string' || !requestedModel.trim()) {
      throw new BadRequestException('请求体缺少 model 字段');
    }

    const model = await this.modelModel
      .findOne({
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ModelStatus.ACTIVE,
        $or: [{ modelId: requestedModel }, { aliases: requestedModel }],
      })
      .exec();
    if (!model) {
      throw new NotFoundException(`模型不存在或已禁用：${requestedModel}`);
    }

    const allowed = ctx.apiKey.allowedModels ?? [];
    if (allowed.length > 0 && !allowed.includes(model.modelId)) {
      throw new ForbiddenException('该 API Key 不允许访问此模型');
    }

    const provider = await this.providerModel
      .findOne({
        _id: model.providerId,
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ProviderStatus.ACTIVE,
      })
      .exec();
    if (!provider) {
      throw new NotFoundException('上游渠道不存在或已禁用');
    }
    if (provider.type !== ProviderType.OPENAI_COMPATIBLE) {
      throw new BadRequestException('暂不支持 anthropic 上游协议');
    }

    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const upstreamBody: Record<string, unknown> = {
      ...body,
      model: model.modelId,
    };
    if (body.stream) {
      upstreamBody.stream_options = {
        ...(body.stream_options as Record<string, unknown> | null | undefined),
        include_usage: true,
      };
    }

    return {
      modelId: model.modelId,
      providerId: String(provider._id),
      multiplier: model.multiplier,
      url,
      upstreamKey,
      upstreamBody,
      requestId: `req_${randomUUID()}`,
      startedAt: Date.now(),
    };
  }

  private async requestUpstream(
    prepared: PreparedRequest,
  ): Promise<globalThis.Response> {
    return fetch(prepared.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${prepared.upstreamKey}`,
      },
      body: JSON.stringify(prepared.upstreamBody),
    });
  }

  private async recordUsage(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    usage: UpstreamUsage | undefined,
  ): Promise<void> {
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;

    await this.usageService.record({
      tenantId: ctx.tenantId,
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      providerId: prepared.providerId,
      modelId: prepared.modelId,
      requestId: prepared.requestId,
      status: UsageStatus.SUCCESS,
      promptTokens,
      completionTokens,
      totalTokens,
      multiplier: prepared.multiplier,
      cost: prepared.multiplier * totalTokens,
      latencyMs: Date.now() - prepared.startedAt,
    });

    await this.apiKeyModel.updateOne(
      { _id: new Types.ObjectId(ctx.apiKeyId) },
      { lastUsedAt: new Date() },
    );
  }

  private async recordError(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    upstreamStatus: number,
  ): Promise<void> {
    await this.usageService.record({
      tenantId: ctx.tenantId,
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      providerId: prepared.providerId,
      modelId: prepared.modelId,
      requestId: prepared.requestId,
      status: UsageStatus.ERROR,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      multiplier: prepared.multiplier,
      cost: 0,
      latencyMs: Date.now() - prepared.startedAt,
      scenario: `upstream_status:${upstreamStatus}`,
    });
  }

  private extractUsage(buffer: string): UpstreamUsage | undefined {
    for (const line of buffer.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload) as { usage?: UpstreamUsage };
        if (obj.usage) return obj.usage;
      } catch {
        // 非 JSON chunk，忽略
      }
    }
    return undefined;
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private encryptionSecret(): string {
    return this.configService.getOrThrow<string>('encryption.secret');
  }
}
