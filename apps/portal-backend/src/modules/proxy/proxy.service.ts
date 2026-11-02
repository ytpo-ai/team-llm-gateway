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
  type ResolvedQuotaLimits,
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
import { RateLimitService } from './rate-limit.service.js';
import { resolveAdapter } from './adapters/adapter.factory.js';
import {
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
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfWeek(now: Date): Date {
  const day = startOfDay(now);
  const weekday = day.getUTCDay();
  const diff = (weekday + 6) % 7;
  return new Date(day.getTime() - diff * DAY_MS);
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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
    }
  }

  private async prepare(
    ctx: ApiKeyContext,
    body: ChatCompletionsBody,
  ): Promise<PreparedRequest> {
    const limits = await this.enforceLimits(ctx);

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

    if (
      !this.quotaLimitService.isModelAllowed(
        limits.memberTemplate,
        ctx.apiKey,
        model.modelId,
      )
    ) {
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
      throw new NotFoundException('上游渠道不存在或已禁用');
    }

    if (
      !this.quotaLimitService.isProviderAllowed(
        limits.team,
        limits.memberTemplate,
        ctx.apiKey,
        String(provider._id),
      )
    ) {
      throw new ForbiddenException('该渠道不在允许范围内');
    }

    const adapter = resolveAdapter(provider.type);
    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const stream = body.stream === true;
    const request = adapter.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: upstreamKey,
      modelId: model.modelId,
      body,
      stream,
    });

    return {
      modelId: model.modelId,
      providerId: String(provider._id),
      multiplier: model.multiplier,
      adapter,
      request,
      requestId: `req_${randomUUID()}`,
      startedAt: Date.now(),
    };
  }

  private async enforceLimits(
    ctx: ApiKeyContext,
  ): Promise<ResolvedQuotaLimits> {
    const limits = await this.quotaLimitService.resolve({
      teamId: ctx.teamId,
      userId: ctx.userId,
      apiKey: ctx.apiKey,
    });

    this.rateLimitService.assertAllowed(
      ctx.apiKeyId,
      limits.rateLimitPerMinute,
    );

    if (ctx.apiKey.maxTokens != null) {
      const used = await this.usageService.sumTokensByApiKey(
        ctx.tenantId,
        ctx.apiKeyId,
      );
      if (used >= ctx.apiKey.maxTokens) {
        throw new HttpException(
          '该 API Key 的 Token 预算已用尽',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.assertPeriodLimits(ctx, limits);

    const balance = await this.billingService.getSpendableBalance(
      ctx.tenantId,
      ctx.teamId,
      ctx.userId,
    );
    if (balance <= 0) {
      throw new HttpException('额度余额不足', HttpStatus.PAYMENT_REQUIRED);
    }

    return limits;
  }

  private async assertPeriodLimits(
    ctx: ApiKeyContext,
    limits: ResolvedQuotaLimits,
  ): Promise<void> {
    const now = new Date();
    const periods = [
      {
        label: '日',
        start: startOfDay(now),
        teamLimit: limits.team?.limitDaily,
        memberLimit: limits.memberTemplate?.limitDaily,
        keyLimit: ctx.apiKey.limitDaily,
      },
      {
        label: '周',
        start: startOfWeek(now),
        teamLimit: limits.team?.limitWeekly,
        memberLimit: limits.memberTemplate?.limitWeekly,
        keyLimit: ctx.apiKey.limitWeekly,
      },
      {
        label: '月',
        start: startOfMonth(now),
        teamLimit: limits.team?.limitMonthly,
        memberLimit: limits.memberTemplate?.limitMonthly,
        keyLimit: ctx.apiKey.limitMonthly,
      },
    ];

    for (const period of periods) {
      if (period.teamLimit != null) {
        const used = await this.usageService.sumTokens({
          tenantId: ctx.tenantId,
          teamId: ctx.teamId,
          since: period.start,
        });
        if (used >= period.teamLimit) {
          throw new HttpException(
            `团队${period.label} Token 限额已用尽`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      if (period.memberLimit != null) {
        const used = await this.usageService.sumTokens({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          since: period.start,
        });
        if (used >= period.memberLimit) {
          throw new HttpException(
            `成员${period.label} Token 限额已用尽`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      if (period.keyLimit != null) {
        const used = await this.usageService.sumTokens({
          tenantId: ctx.tenantId,
          apiKeyId: ctx.apiKeyId,
          since: period.start,
        });
        if (used >= period.keyLimit) {
          throw new HttpException(
            `API Key ${period.label} Token 限额已用尽`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }
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
