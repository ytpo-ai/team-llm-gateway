import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { Model, Types } from 'mongoose';
import { decrypt } from '../../common/crypto/cipher.js';
import { BillingService } from '../billing/billing.service.js';
import {
  QuotaLimitService,
  type ResolvedPolicyContext,
} from '../billing/quota-limit.service.js';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import { Model as ModelEntity, ModelStatus } from '../models/schemas/model.schema.js';
import {
  Provider,
  ProviderStatus,
} from '../providers/schemas/provider.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';
import { ConcurrencyService } from './concurrency.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { resolveAdapter } from './adapters/adapter.factory.js';
import {
  anthropicError,
  anthropicToOpenAI,
  OpenAIAnthropicStreamTransformer,
  openAIToAnthropic,
} from './adapters/anthropic-protocol.js';
import {
  asString,
  parseJsonObject,
  type AdapterRequest,
  type UpstreamAdapter,
  type UpstreamUsage,
} from './adapters/upstream-adapter.js';

interface ChatCompletionsBody {
  model?: unknown;
  stream?: unknown;
  stream_options?: unknown;
  [key: string]: unknown;
}

interface PreparedRequest {
  modelId: string;
  providerId: string;
  multiplier: number;
  adapter: UpstreamAdapter;
  request: AdapterRequest;
  requestId: string;
  startedAt: number;
  releaseConcurrency: () => void;
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
    private readonly billingService: BillingService,
    private readonly quotaLimitService: QuotaLimitService,
    private readonly rateLimitService: RateLimitService,
    private readonly concurrencyService: ConcurrencyService,
  ) {}

  async listModels(ctx: ApiKeyContext) {
    const activeProviders = await this.providerModel
      .find({
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ProviderStatus.ACTIVE,
      })
      .select('_id')
      .exec();
    const activeProviderIds = activeProviders.map((p) => p._id);

    const models = await this.modelModel
      .find({
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ModelStatus.ACTIVE,
        providerId: { $in: activeProviderIds },
      })
      .sort({ createdAt: -1 })
      .exec();

    const resolved = await this.quotaLimitService.resolve({
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKey: ctx.apiKey,
    });
    const whitelist = resolved.key?.modelWhitelist ?? [];
    const visible = whitelist.length > 0
      ? models.filter((m) => whitelist.includes(m.modelId))
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

    try {
      const upstreamRes = await this.requestUpstream(prepared);
      const text = await upstreamRes.text();

      if (upstreamRes.ok) {
        const openaiJson = prepared.adapter.parseResponse(text, prepared.modelId);
        await this.recordUsage(
          ctx,
          prepared,
          (openaiJson as { usage?: UpstreamUsage }).usage,
        );
        res.status(upstreamRes.status);
        return openaiJson;
      }

      await this.recordError(ctx, prepared, upstreamRes.status);
      res.status(upstreamRes.status);
      return parseJsonObject(text) ?? { message: text };
    } finally {
      prepared.releaseConcurrency();
    }
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
      prepared.releaseConcurrency();
      res.status(upstreamRes.status).json(parseJsonObject(text) ?? { message: text });
      return;
    }

    res.status(200);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');

    const transformer = prepared.adapter.createStreamTransformer();
    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const emit = transformer.push(chunk);
        if (emit) res.write(emit);
      }
      const tail = transformer.finish();
      if (tail) res.write(tail);
    } finally {
      res.end();
      await this.recordUsage(ctx, prepared, transformer.getUsage());
      prepared.releaseConcurrency();
    }
  }

  async messages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<unknown> {
    const prepared = await this.prepare(ctx, anthropicToOpenAI(body));

    try {
      const upstreamRes = await this.requestUpstream(prepared);
      const text = await upstreamRes.text();

      if (upstreamRes.ok) {
        const openaiJson = prepared.adapter.parseResponse(text, prepared.modelId);
        await this.recordUsage(
          ctx,
          prepared,
          (openaiJson as { usage?: UpstreamUsage }).usage,
        );
        res.status(upstreamRes.status);
        return openAIToAnthropic(openaiJson, prepared.modelId);
      }

      await this.recordError(ctx, prepared, upstreamRes.status);
      res.status(upstreamRes.status);
      const detail = parseJsonObject(text) ?? {};
      return anthropicError(
        asString((detail as Record<string, unknown>).message, text),
      );
    } finally {
      prepared.releaseConcurrency();
    }
  }

  async streamMessages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<void> {
    const prepared = await this.prepare(ctx, anthropicToOpenAI(body));

    const upstreamRes = await this.requestUpstream(prepared);
    if (!upstreamRes.ok || !upstreamRes.body) {
      const text = await upstreamRes.text();
      await this.recordError(ctx, prepared, upstreamRes.status);
      prepared.releaseConcurrency();
      const detail = parseJsonObject(text) ?? {};
      res
        .status(upstreamRes.status)
        .json(
          anthropicError(
            asString((detail as Record<string, unknown>).message, text),
          ),
        );
      return;
    }

    res.status(200);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');

    const openaiTransformer = prepared.adapter.createStreamTransformer();
    const anthropicTransformer = new OpenAIAnthropicStreamTransformer();
    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const openaiSse = openaiTransformer.push(chunk);
        if (openaiSse) {
          const anthropicSse = anthropicTransformer.push(openaiSse);
          if (anthropicSse) res.write(anthropicSse);
        }
      }
      const openaiTail = openaiTransformer.finish();
      if (openaiTail) {
        const anthropicSse = anthropicTransformer.push(openaiTail);
        if (anthropicSse) res.write(anthropicSse);
      }
      const anthropicTail = anthropicTransformer.finish();
      if (anthropicTail) res.write(anthropicTail);
    } finally {
      res.end();
      await this.recordUsage(ctx, prepared, openaiTransformer.getUsage());
      prepared.releaseConcurrency();
    }
  }

  private async prepare(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
  ): Promise<PreparedRequest> {
    const { resolved, releaseConcurrency } = await this.enforceLimits(ctx);

    const requestedModel = body.model;
    if (typeof requestedModel !== 'string' || !requestedModel.trim()) {
      releaseConcurrency();
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
      releaseConcurrency();
      throw new NotFoundException(`模型不存在或已禁用：${requestedModel}`);
    }

    if (!this.quotaLimitService.isModelAllowed(resolved, model.modelId)) {
      releaseConcurrency();
      throw new ForbiddenException('该 API Key 或成员角色不允许访问此模型');
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
      releaseConcurrency();
      throw new NotFoundException('上游渠道不存在或已禁用');
    }

    if (
      !this.quotaLimitService.isProviderAllowed(resolved, String(provider._id))
    ) {
      releaseConcurrency();
      throw new ForbiddenException('该渠道不在允许范围内');
    }

    const adapter = resolveAdapter(provider.type);
    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const stream = body.stream === true;
    const request = await adapter.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: upstreamKey,
      modelId: model.modelId,
      body,
      stream,
      authType: provider.authType,
    });

    return {
      modelId: model.modelId,
      providerId: String(provider._id),
      multiplier: model.multiplier,
      adapter,
      request,
      requestId: `req_${randomUUID()}`,
      startedAt: Date.now(),
      releaseConcurrency,
    };
  }

  private async enforceLimits(
    ctx: ApiKeyContext,
  ): Promise<{ resolved: ResolvedPolicyContext; releaseConcurrency: () => void }> {
    const resolved = await this.quotaLimitService.resolve({
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKey: ctx.apiKey,
    });

    const rateLimits = this.quotaLimitService.resolveRateLimits(resolved);

    if (rateLimits.teamPerMinute != null) {
      this.rateLimitService.assertAllowed(
        `team:${ctx.teamId}`,
        rateLimits.teamPerMinute,
      );
    }
    if (rateLimits.memberPerMinute != null) {
      this.rateLimitService.assertAllowed(ctx.userId, rateLimits.memberPerMinute);
    }
    if (rateLimits.keyPerMinute != null) {
      this.rateLimitService.assertAllowed(ctx.apiKeyId, rateLimits.keyPerMinute);
    }

    await this.quotaLimitService.assertUsageLimits(resolved, {
      tenantId: ctx.tenantId,
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
    });

    const balance = await this.billingService.getSpendableBalance(
      ctx.tenantId,
      ctx.teamId,
      ctx.userId,
    );
    if (balance <= 0) {
      throw new HttpException('额度余额不足', HttpStatus.PAYMENT_REQUIRED);
    }

    const releaseConcurrency = this.concurrencyService.acquire(
      ctx.apiKeyId,
      rateLimits.keyConcurrency,
    );

    return { resolved, releaseConcurrency };
  }

  private async requestUpstream(
    prepared: PreparedRequest,
  ): Promise<globalThis.Response> {
    return fetch(prepared.request.url, {
      method: 'POST',
      headers: prepared.request.headers,
      body: prepared.request.body,
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

    if (totalTokens > 0) {
      await this.billingService.deduct({
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        userId: ctx.userId,
        cost: prepared.multiplier * totalTokens,
        referenceId: prepared.requestId,
      });
    }
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

  private encryptionSecret(): string {
    return this.configService.getOrThrow<string>('encryption.secret');
  }
}
