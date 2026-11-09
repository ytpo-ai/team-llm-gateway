import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { Model, Types } from 'mongoose';
import { BillingService } from '../billing/billing.service.js';
import {
  QuotaLimitService,
} from '../billing/quota-limit.service.js';
import type { ApiKeyDocument } from '../api-keys/schemas/api-key.schema.js';
import { ApiKey } from '../api-keys/schemas/api-key.schema.js';
import {
  Model as ModelEntity,
  ModelStatus,
} from '../models/schemas/model.schema.js';
import {
  Provider,
  ProviderAuthType,
  ProviderStatus,
  ProviderType,
} from '../providers/schemas/provider.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import { ProviderUsageService } from '../usage/provider-usage.service.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';
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
import { PolicyResolver } from './policy-resolver.service.js';
import type { MeterBackend } from './meter-backend.interface.js';
import { METER_BACKEND_TOKEN } from './meter-backend.interface.js';
import { Action, Candidate, Measure, StandardPolicy } from './protocol/types.js';

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
  releaseConcurrency: () => Promise<void>;
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
    private readonly providerUsageService: ProviderUsageService,
    private readonly policyResolver: PolicyResolver,
    @Inject(METER_BACKEND_TOKEN) private readonly meterBackend: MeterBackend,
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
    const visible =
      whitelist.length > 0
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
    return this.process(ctx, body, res, 'non-stream');
  }

  async streamChatCompletions(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    res: ExpressResponse,
  ): Promise<void> {
    await this.process(ctx, body, res, 'stream-openai');
  }

  async messages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<unknown> {
    const openaiBody = anthropicToOpenAI(body);
    const result = await this.process(
      ctx,
      openaiBody as ChatCompletionsBody,
      res,
      'non-stream',
    );
    return openAIToAnthropic(result as Record<string, unknown>, (openaiBody.model as string) ?? '');
  }

  async streamMessages(
    ctx: ApiKeyContext,
    body: Record<string, unknown>,
    res: ExpressResponse,
  ): Promise<void> {
    const openaiBody = anthropicToOpenAI(body);
    await this.process(
      ctx,
      openaiBody as ChatCompletionsBody,
      res,
      'stream-anthropic',
    );
  }

  // ── unified process method (new protocol path) ──

  private async process(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    res: ExpressResponse,
    mode: 'non-stream' | 'stream-openai' | 'stream-anthropic',
  ): Promise<unknown> {
    // 1. Resolve policy + candidates via PolicyResolver
    const { policy, candidates } = await this.policyResolver.resolve({
      tenantId: ctx.tenantId,
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKey: ctx.apiKey as unknown as ApiKeyDocument,
      requestedModel: typeof body.model === 'string' ? body.model : '',
    });

    // 2. Layer ①: state check
    this.assertPolicyStates(policy);

    // 3. Layer ③: limit check + concurrency acquisition
    const releaseConcurrency = await this.assertLimits(policy);

    // 4. Fallback loop over pre-resolved candidates
    return this.executeWithFallback(
      ctx, body, policy, candidates, res, mode, releaseConcurrency,
    );
  }

  // ── three-layer check ──

  private assertPolicyStates(policy: StandardPolicy): void {
    for (const state of policy.states) {
      if (!state.ok && state.action === Action.BLOCK) {
        const status =
          state.code === 'BALANCE_INSUFFICIENT'
            ? HttpStatus.PAYMENT_REQUIRED
            : HttpStatus.FORBIDDEN;
        throw new HttpException(state.message ?? '请求被拒绝', status);
      }
      if (!state.ok && state.action === Action.WARN) {
        this.logger.warn(`策略预警：${state.name} - ${state.message}`);
      }
    }
  }

  private async assertLimits(
    policy: StandardPolicy,
  ): Promise<() => Promise<void>> {
    const releases: Array<() => Promise<void>> = [];

    for (const limit of policy.limits) {
      // Concurrency is handled separately
      if (limit.measure === Measure.CONCURRENCY) {
        if (limit.scope !== 'key') continue;
        try {
          const release = await (
            this.meterBackend as MeterBackend & {
              tryAcquireConcurrency?: (
                key: string,
                limit: number,
              ) => Promise<() => Promise<void>>;
            }
          ).tryAcquireConcurrency?.(policy.subject.apiKeyId, limit.limit);
          if (release) {
            releases.push(release);
          } else {
            releases.push(
              this.meterBackend.acquireConcurrency(
                policy.subject.apiKeyId,
                limit.limit,
              ),
            );
          }
        } catch {
          throw new HttpException(
            '并发数已达上限',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        continue;
      }

      const scope = {
        kind: limit.scope,
        id:
          limit.scope === 'team'
            ? policy.subject.teamId
            : limit.scope === 'member'
              ? policy.subject.userId
              : policy.subject.apiKeyId,
      };

      const ok = await this.meterBackend.checkLimit(
        scope,
        limit.measure,
        limit.window,
        limit.limit,
      );

      if (!ok && limit.action === Action.BLOCK) {
        throw new HttpException(
          `${limit.scope}级限额已用尽`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (!ok && limit.action === Action.WARN) {
        this.logger.warn(
          `策略预警：${limit.scope}级 ${limit.measure}/${limit.window} 限额已用尽`,
        );
      }
    }

    return async () => {
      for (const release of releases.reverse()) {
        await release();
      }
    };
  }

  // ── fallback execution ──

  private async executeWithFallback(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    policy: StandardPolicy,
    candidates: Candidate[],
    res: ExpressResponse,
    mode: 'non-stream' | 'stream-openai' | 'stream-anthropic',
    releaseConcurrency: () => Promise<void>,
  ): Promise<unknown> {
    let lastError: number = 502;
    let lastBody: unknown = { message: '无可用的上游渠道' };

    for (const candidate of candidates) {
      const prepared = await this.prepareCandidate(ctx, body, candidate);
      if (!prepared) continue;
      prepared.releaseConcurrency = releaseConcurrency;

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

      if (mode === 'non-stream') {
        const text = await upstreamRes.text();
        if (upstreamRes.ok) {
          await this.handleSuccess(ctx, prepared, upstreamRes);
          const openaiJson = prepared.adapter.parseResponse(
            text,
            prepared.modelId,
          );
          await this.recordUsage(
            ctx,
            prepared,
            policy,
            (openaiJson as { usage?: UpstreamUsage }).usage,
          );
          await releaseConcurrency();
          res.status(upstreamRes.status);
          return openaiJson;
        }
        if (upstreamRes.status === 429) {
          await this.handleRateLimited(ctx, prepared, upstreamRes);
          continue;
        }
        if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
          await this.handleServerError(ctx, prepared, upstreamRes);
          lastError = upstreamRes.status;
          lastBody = parseJsonObject(text) ?? { message: text };
          continue;
        }
        await this.recordError(ctx, prepared, upstreamRes.status);
        await releaseConcurrency();
        res.status(upstreamRes.status);
        return parseJsonObject(text) ?? { message: text };
      }

      // Streaming path
      if (!upstreamRes.ok || !upstreamRes.body) {
        const text = await upstreamRes.text();
        if (upstreamRes.status === 429) {
          await this.handleRateLimited(ctx, prepared, upstreamRes);
          continue;
        }
        if (upstreamRes.status >= 500 || upstreamRes.status === 408) {
          await this.handleServerError(ctx, prepared, upstreamRes);
          lastError = upstreamRes.status;
          lastBody = parseJsonObject(text) ?? { message: text };
          continue;
        }
        await this.recordError(ctx, prepared, upstreamRes.status);
        await releaseConcurrency();
        if (mode === 'stream-anthropic') {
          const detail = parseJsonObject(text) ?? {};
          res
            .status(upstreamRes.status)
            .json(
              anthropicError(
                asString(
                  (detail as Record<string, unknown>).message,
                  text,
                ),
              ),
            );
        } else {
          res
            .status(upstreamRes.status)
            .json(parseJsonObject(text) ?? { message: text });
        }
        return;
      }

      // Stream processing
      await this.handleSuccess(ctx, prepared, upstreamRes);
      await this.streamResponse(
        ctx,
        prepared,
        policy,
        upstreamRes,
        res,
        mode,
        releaseConcurrency,
      );
      return;
    }

    // All exhausted
    await releaseConcurrency();
    if (mode === 'stream-anthropic' && typeof lastBody === 'object') {
      lastBody = anthropicError(
        asString(
          (lastBody as Record<string, unknown>).message as string | undefined,
          '无可用的上游渠道',
        ),
      );
    }
    res.status(lastError);
    return lastBody;
  }

  // ── candidate preparation ──

  private async prepareCandidate(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
    candidate: Candidate,
  ): Promise<PreparedRequest | null> {
    const adapter = resolveAdapter(candidate.type as unknown as ProviderType);
    const stream = body.stream === true;

    const request = await adapter.buildRequest({
      baseUrl: candidate.baseUrl,
      apiKey: candidate.apiKey,
      modelId: ctx.apiKey ? '' : '', // modelId will be set by adapter from body
      body,
      stream,
      authType: candidate.authType as unknown as ProviderAuthType,
    });

    // Override modelId with the original requested model
    const modelId = typeof body.model === 'string' ? body.model : 'unknown';

    return {
      modelId,
      providerId: candidate.providerId,
      multiplier: candidate.multiplier,
      adapter,
      request,
      requestId: `req_${randomUUID()}`,
      startedAt: Date.now(),
      releaseConcurrency: () => Promise.resolve(),
    };
  }

  // ── upstream call ──

  private async requestUpstream(
    prepared: PreparedRequest,
  ): Promise<globalThis.Response> {
    return fetch(prepared.request.url, {
      method: 'POST',
      headers: prepared.request.headers,
      body: prepared.request.body,
    });
  }

  // ── response handling ──

  private async handleSuccess(
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
    await this.providerUsageService.recordSuccess(
      ctx.tenantId,
      ctx.teamId,
      prepared.providerId,
    );
  }

  private async handleRateLimited(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    upstreamRes: globalThis.Response,
  ): Promise<void> {
    await this.providerUsageService.markExhausted(
      ctx.tenantId,
      ctx.teamId,
      prepared.providerId,
      '上游返回 429 Too Many Requests',
      this.headersToRecord(upstreamRes),
    );
    this.logger.warn(
      `Provider channel ${prepared.providerId} rate limited (429), falling back`,
    );
  }

  private async handleServerError(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    upstreamRes: globalThis.Response,
  ): Promise<void> {
    await this.providerUsageService.recordFailure(
      ctx.tenantId,
      ctx.teamId,
      prepared.providerId,
      `上游返回 ${upstreamRes.status}`,
    );
    this.logger.warn(
      `Provider channel ${prepared.providerId} returned ${upstreamRes.status}, trying next`,
    );
  }

  private async streamResponse(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    policy: StandardPolicy,
    upstreamRes: globalThis.Response,
    res: ExpressResponse,
    mode: 'stream-openai' | 'stream-anthropic',
    releaseConcurrency: () => Promise<void>,
  ): Promise<void> {
    res.status(200);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');

    const transformer = prepared.adapter.createStreamTransformer();
    const anthropicTransformer =
      mode === 'stream-anthropic'
        ? new OpenAIAnthropicStreamTransformer()
        : null;
    const reader = upstreamRes.body!.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const emit = transformer.push(chunk);
        if (emit) {
          if (anthropicTransformer) {
            const anthropicSse = anthropicTransformer.push(emit);
            if (anthropicSse) res.write(anthropicSse);
          } else {
            res.write(emit);
          }
        }
      }
      const tail = transformer.finish();
      if (tail) {
        if (anthropicTransformer) {
          const ath = anthropicTransformer.push(tail);
          if (ath) res.write(ath);
          const finalTail = anthropicTransformer.finish();
          if (finalTail) res.write(finalTail);
        } else {
          res.write(tail);
        }
      }
    } finally {
      res.end();
      await this.recordUsage(ctx, prepared, policy, transformer.getUsage());
      await releaseConcurrency();
    }
  }

  // ── metering ──

  private async recordUsage(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    policy: StandardPolicy,
    usage: UpstreamUsage | undefined,
  ): Promise<void> {
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
    const cost = prepared.multiplier * totalTokens;
    const latencyMs = Date.now() - prepared.startedAt;

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
      cost,
      latencyMs,
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
        cost,
        referenceId: prepared.requestId,
        totalTokens,
      });
    }

    // Increment MeterBackend counters
    const subj = policy.subject;
    for (const scope of [
      { kind: 'team' as const, id: subj.teamId },
      { kind: 'member' as const, id: subj.userId },
      { kind: 'key' as const, id: subj.apiKeyId },
    ]) {
      await this.meterBackend.increment(
        scope,
        Measure.TOKEN,
        'day' as never, // permanent: increment the cumulative counter
        totalTokens,
      );
    }
  }

  private async recordError(
    ctx: ApiKeyContext,
    prepared: PreparedRequest,
    upstreamStatus: number = 0,
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

  private headersToRecord(
    upstreamRes: globalThis.Response,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    upstreamRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
}