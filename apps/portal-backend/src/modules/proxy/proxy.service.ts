import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
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
import {
  Model as ModelEntity,
  ModelDocument,
  ModelStatus,
  type ProviderBinding,
} from '../models/schemas/model.schema.js';
import {
  Provider,
  ProviderStatus,
} from '../providers/schemas/provider.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import { ProviderUsageService } from '../usage/provider-usage.service.js';
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
  private readonly logger = new Logger(ProxyService.name);

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
    private readonly providerUsageService: ProviderUsageService,
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
    // Enforce limits once (shared across retries)
    const { resolved, releaseConcurrency } = await this.enforceLimits(ctx);

    // Resolve model once
    const model = await this.resolveModel(ctx, body.model, resolved);

    // Get sorted provider candidates
    const candidates = this.getProviderCandidates(model);

    let lastError: number = 502;
    let lastBody: unknown = { message: '无可用的上游渠道' };

    for (const candidateId of candidates) {
      const prepared = await this.tryCandidate(
        ctx,
        model,
        body,
        candidateId,
        resolved,
      );
      if (!prepared) continue;

      // Attach concurrency release
      prepared.releaseConcurrency = releaseConcurrency;

      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await this.requestUpstream(prepared);
      } catch (err) {
        // Network error (DNS/timeout/connection refused) → record failure, try next
        const message = err instanceof Error ? err.message : '网络错误';
        await this.providerUsageService.recordFailure(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游网络错误：${message}`,
        );
        lastError = 502;
        lastBody = { message: `上游网络错误：${message}` };
        this.logger.warn(
          `Provider channel ${prepared.providerId} network error: ${message}, trying next`,
        );
        continue;
      }
      const text = await upstreamRes.text();

      if (upstreamRes.ok) {
        // Extract rate-limit headers for future reference
        await this.extractRateLimitHeaders(ctx, prepared, upstreamRes);
        await this.providerUsageService.recordSuccess(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
        );

        const openaiJson = prepared.adapter.parseResponse(text, prepared.modelId);
        await this.recordUsage(
          ctx,
          prepared,
          (openaiJson as { usage?: UpstreamUsage }).usage,
        );
        releaseConcurrency();
        res.status(upstreamRes.status);
        return openaiJson;
      }

      // 429 Rate Limited → mark exhausted, try next candidate
      if (upstreamRes.status === 429) {
        await this.providerUsageService.markExhausted(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游返回 429 Too Many Requests`,
          this.headersToRecord(upstreamRes),
        );
        this.logger.warn(
          `Provider channel ${prepared.providerId} rate limited (429), falling back`,
        );
        continue;
      }

      // Server errors (5xx, 408) → record failure, try next candidate
      if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
        await this.providerUsageService.recordFailure(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游返回 ${upstreamRes.status}`,
        );
        lastError = upstreamRes.status;
        lastBody = parseJsonObject(text) ?? { message: text };
        this.logger.warn(
          `Provider channel ${prepared.providerId} returned ${upstreamRes.status}, trying next`,
        );
        continue;
      }

      // Client errors other than 429 → don't retry, return immediately
      await this.recordError(ctx, prepared, upstreamRes.status);
      releaseConcurrency();
      res.status(upstreamRes.status);
      return parseJsonObject(text) ?? { message: text };
    }

    // All candidates exhausted
    releaseConcurrency();
    res.status(lastError);
    return lastBody;
  }

  async streamChatCompletions(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    res: ExpressResponse,
  ): Promise<void> {
    // Enforce limits once (shared across retries)
    const { resolved, releaseConcurrency } = await this.enforceLimits(ctx);

    // Resolve model once
    const model = await this.resolveModel(ctx, body.model, resolved);

    // Get sorted provider candidates
    const candidates = this.getProviderCandidates(model);

    let lastError: number = 502;
    let lastBody: unknown = { message: '无可用的上游渠道' };

    for (const candidateId of candidates) {
      const prepared = await this.tryCandidate(
        ctx,
        model,
        body,
        candidateId,
        resolved,
      );
      if (!prepared) continue;

      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await this.requestUpstream(prepared);
      } catch (err) {
        const message = err instanceof Error ? err.message : '网络错误';
        await this.providerUsageService.recordFailure(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游网络错误：${message}`,
        );
        lastError = 502;
        lastBody = { message: `上游网络错误：${message}` };
        this.logger.warn(
          `Provider channel ${prepared.providerId} network error: ${message}, trying next`,
        );
        continue;
      }
      if (!upstreamRes.ok || !upstreamRes.body) {
        const text = await upstreamRes.text();

        // 429 Rate Limited → mark exhausted, try next
        if (upstreamRes.status === 429) {
          await this.providerUsageService.markExhausted(
            ctx.tenantId,
            ctx.teamId,
            prepared.providerId,
            `上游返回 429 Too Many Requests`,
            this.headersToRecord(upstreamRes),
          );
          this.logger.warn(
            `Provider channel ${prepared.providerId} rate limited (429), falling back`,
          );
          continue;
        }

        // Server errors → record failure, try next
        if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
          await this.providerUsageService.recordFailure(
            ctx.tenantId,
            ctx.teamId,
            prepared.providerId,
            `上游返回 ${upstreamRes.status}`,
          );
          lastError = upstreamRes.status;
          lastBody = parseJsonObject(text) ?? { message: text };
          continue;
        }

        // Client error → return immediately
        await this.recordError(ctx, prepared, upstreamRes.status);
        releaseConcurrency();
        res.status(upstreamRes.status).json(parseJsonObject(text) ?? { message: text });
        return;
      }

      // Success — stream the response
      await this.extractRateLimitHeaders(ctx, prepared, upstreamRes);
      await this.providerUsageService.recordSuccess(
        ctx.tenantId,
        ctx.teamId,
        prepared.providerId,
      );

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
        releaseConcurrency();
      }
      return;
    }

    // All candidates exhausted
    releaseConcurrency();
    res.status(lastError).json(lastBody);
  }

  async messages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<unknown> {
    const openaiBody = anthropicToOpenAI(body);
    const { resolved, releaseConcurrency } = await this.enforceLimits(ctx);
    const model = await this.resolveModel(ctx, openaiBody.model, resolved);
    const candidates = this.getProviderCandidates(model);

    let lastError: number = 502;
    let lastBody: unknown = { message: '无可用的上游渠道' };

    for (const candidateId of candidates) {
      const prepared = await this.tryCandidate(
        ctx,
        model,
        openaiBody as ChatCompletionsBody,
        candidateId,
        resolved,
      );
      if (!prepared) continue;

      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await this.requestUpstream(prepared);
      } catch (err) {
        const message = err instanceof Error ? err.message : '网络错误';
        await this.providerUsageService.recordFailure(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游网络错误：${message}`,
        );
        lastError = 502;
        lastBody = anthropicError(`上游网络错误：${message}`);
        this.logger.warn(
          `Provider channel ${prepared.providerId} network error: ${message}, trying next`,
        );
        continue;
      }
      const text = await upstreamRes.text();

      if (upstreamRes.ok) {
        await this.extractRateLimitHeaders(ctx, prepared, upstreamRes);
        await this.providerUsageService.recordSuccess(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
        );
        const openaiJson = prepared.adapter.parseResponse(text, prepared.modelId);
        await this.recordUsage(
          ctx,
          prepared,
          (openaiJson as { usage?: UpstreamUsage }).usage,
        );
        releaseConcurrency();
        res.status(upstreamRes.status);
        return openAIToAnthropic(openaiJson, prepared.modelId);
      }

      if (upstreamRes.status === 429) {
        await this.providerUsageService.markExhausted(
          ctx.tenantId, ctx.teamId, prepared.providerId,
          `上游返回 429 Too Many Requests`,
          this.headersToRecord(upstreamRes),
        );
        continue;
      }

      if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
        await this.providerUsageService.recordFailure(
          ctx.tenantId, ctx.teamId, prepared.providerId,
          `上游返回 ${upstreamRes.status}`,
        );
        lastError = upstreamRes.status;
        const detail = parseJsonObject(text) ?? {};
        lastBody = anthropicError(
          asString((detail as Record<string, unknown>).message, text),
        );
        continue;
      }

      await this.recordError(ctx, prepared, upstreamRes.status);
      releaseConcurrency();
      res.status(upstreamRes.status);
      const detail = parseJsonObject(text) ?? {};
      return anthropicError(
        asString((detail as Record<string, unknown>).message, text),
      );
    }

    releaseConcurrency();
    res.status(lastError);
    return lastBody;
  }

  async streamMessages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<void> {
    const openaiBody = anthropicToOpenAI(body);
    const { resolved, releaseConcurrency } = await this.enforceLimits(ctx);
    const model = await this.resolveModel(ctx, openaiBody.model, resolved);
    const candidates = this.getProviderCandidates(model);

    let lastError: number = 502;
    let lastBody: unknown = { message: '无可用的上游渠道' };

    for (const candidateId of candidates) {
      const prepared = await this.tryCandidate(
        ctx,
        model,
        openaiBody as ChatCompletionsBody,
        candidateId,
        resolved,
      );
      if (!prepared) continue;

      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await this.requestUpstream(prepared);
      } catch (err) {
        const message = err instanceof Error ? err.message : '网络错误';
        await this.providerUsageService.recordFailure(
          ctx.tenantId,
          ctx.teamId,
          prepared.providerId,
          `上游网络错误：${message}`,
        );
        lastError = 502;
        lastBody = anthropicError(`上游网络错误：${message}`);
        this.logger.warn(
          `Provider channel ${prepared.providerId} network error: ${message}, trying next`,
        );
        continue;
      }
      if (!upstreamRes.ok || !upstreamRes.body) {
        const text = await upstreamRes.text();

        if (upstreamRes.status === 429) {
          await this.providerUsageService.markExhausted(
            ctx.tenantId, ctx.teamId, prepared.providerId,
            `上游返回 429 Too Many Requests`,
            this.headersToRecord(upstreamRes),
          );
          continue;
        }

        if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
          await this.providerUsageService.recordFailure(
            ctx.tenantId, ctx.teamId, prepared.providerId,
            `上游返回 ${upstreamRes.status}`,
          );
          lastError = upstreamRes.status;
          const detail = parseJsonObject(text) ?? {};
          lastBody = anthropicError(
            asString((detail as Record<string, unknown>).message, text),
          );
          continue;
        }

        await this.recordError(ctx, prepared, upstreamRes.status);
        releaseConcurrency();
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

      // Success — stream the response
      await this.extractRateLimitHeaders(ctx, prepared, upstreamRes);
      await this.providerUsageService.recordSuccess(
        ctx.tenantId,
        ctx.teamId,
        prepared.providerId,
      );

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
        releaseConcurrency();
      }
      return;
    }

    releaseConcurrency();
    res.status(lastError).json(lastBody);
  }

  /**
   * Build sorted provider candidate IDs from model bindings, ordered by priority (ascending).
   * Falls back to model.providerId if no bindings configured.
   */
  private getProviderCandidates(model: ModelDocument): string[] {
    const bindings: ProviderBinding[] =
      model.providerBindings && model.providerBindings.length > 0
        ? [...model.providerBindings]
        : [];

    // Ensure primary providerId is included (highest priority = 0)
    const primaryId = String(model.providerId);
    const hasPrimary = bindings.some(
      (b) => String(b.providerId) === primaryId,
    );
    if (!hasPrimary) {
      bindings.push({
        providerId: model.providerId,
        priority: 0,
      } as ProviderBinding);
    }

    // Sort by priority ascending (0 = highest, 2 = lowest)
    bindings.sort((a, b) => a.priority - b.priority);
    return bindings.map((b) => String(b.providerId));
  }

  /**
   * Try to build a PreparedRequest for a specific provider candidate.
   * Returns null if the provider is not available (disabled, exhausted, or not allowed).
   */
  private async tryCandidate(
    ctx: ApiKeyContext,
    model: ModelDocument,
    body: ChatCompletionsBody,
    providerId: string,
    resolved: ResolvedPolicyContext,
  ): Promise<PreparedRequest | null> {
    const provider = await this.providerModel
      .findOne({
        _id: new Types.ObjectId(providerId),
        tenantId: ctx.tenantId,
        teamId: ctx.teamId,
        status: ProviderStatus.ACTIVE,
      })
      .exec();
    if (!provider) return null;

    if (!this.quotaLimitService.isProviderAllowed(resolved, providerId)) {
      return null;
    }

    // Skip if provider is unavailable (rate limited or in circuit-breaker cooldown)
    const availability = await this.providerUsageService.getAvailability(
      ctx.tenantId,
      ctx.teamId,
      providerId,
    );
    if (!availability.available) {
      this.logger.debug(
        `Provider ${provider.name} unavailable (${availability.reason}), skipping`,
      );
      return null;
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
      releaseConcurrency: () => {},
    };
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

    // Get sorted provider candidates
    const candidates = this.getProviderCandidates(model);

    // Try each candidate in priority order
    for (const candidateId of candidates) {
      const prepared = await this.tryCandidate(
        ctx,
        model,
        body,
        candidateId,
        resolved,
      );
      if (prepared) {
        // Attach the releaseConcurrency from enforceLimits
        prepared.releaseConcurrency = releaseConcurrency;
        return prepared;
      }
    }

    // No candidate available
    releaseConcurrency();
    throw new NotFoundException('无可用的上游渠道（所有渠道已禁用或已耗尽）');
  }

  /**
   * Resolve a model by its id or aliases.
   */
  private async resolveModel(
    ctx: ApiKeyContext,
    requestedModel: unknown,
    resolved: ResolvedPolicyContext,
  ): Promise<ModelDocument> {
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

    if (!this.quotaLimitService.isModelAllowed(resolved, model.modelId)) {
      throw new ForbiddenException('该 API Key 或成员角色不允许访问此模型');
    }

    return model;
  }

  /**
   * Extract rate-limit info from upstream response headers.
   */
  private async extractRateLimitHeaders(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    upstreamRes: globalThis.Response,
  ): Promise<void> {
    await this.providerUsageService.updateFromHeaders(
      ctx.tenantId,
      ctx.teamId,
      prepared.providerId,
      this.headersToRecord(upstreamRes),
    );
  }

  private headersToRecord(
    upstreamRes: globalThis.Response,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    upstreamRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
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
        totalTokens,
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
