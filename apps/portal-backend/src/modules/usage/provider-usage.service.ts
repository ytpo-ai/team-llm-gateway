import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider } from '../providers/schemas/provider.schema.js';
import {
  ProviderUsage,
  ProviderUsageDocument,
  ProviderUsageStatus,
} from './schemas/provider-usage.schema.js';

export interface ProviderUsageView {
  providerId: string;
  providerName: string;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  exhaustedUntil: string | null;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  errorMessage: string | null;
  lastStatus: string;
  fetchedAt: string;
}

export interface ProviderAvailability {
  available: boolean;
  reason: string | null;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_BASE_MS = 30_000; // 30s
const DEFAULT_COOLDOWN_MAX_MS = 600_000; // 10min
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000; // 60s

/**
 * Channel health service, driven by passive signals only (no upstream usage API):
 * - 429 → mark exhausted until a recovery deadline (Retry-After / rate-limit-reset / backoff)
 * - 5xx/408/network errors → consecutive failure count, circuit-breaker cooldown
 * - success → reset all failure state
 */
@Injectable()
export class ProviderUsageService {
  private readonly logger = new Logger(ProviderUsageService.name);

  constructor(
    @InjectModel(ProviderUsage.name)
    private readonly providerUsageModel: Model<ProviderUsage>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check whether a provider channel is currently available.
   * Unavailable while exhaustedUntil (429) or cooldownUntil (circuit breaker) is in the future.
   * Returns available=true when no snapshot exists (optimistic).
   */
  async getAvailability(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderAvailability> {
    const snapshot = await this.findSnapshot(tenantId, teamId, providerId);
    if (!snapshot) return { available: true, reason: null };

    const now = Date.now();
    if (snapshot.exhaustedUntil && snapshot.exhaustedUntil.getTime() > now) {
      return {
        available: false,
        reason: snapshot.errorMessage ?? '上游限流中（429）',
      };
    }
    if (snapshot.cooldownUntil && snapshot.cooldownUntil.getTime() > now) {
      return {
        available: false,
        reason:
          snapshot.errorMessage ??
          `渠道熔断冷却中（连续失败 ${snapshot.consecutiveFailures} 次）`,
      };
    }
    return { available: true, reason: null };
  }

  /**
   * Mark a provider as rate limited (429).
   * Recovery deadline is resolved from response headers (Retry-After /
   * x-ratelimit-reset-*) when present, otherwise an exponential backoff
   * window based on the consecutive failure count.
   */
  async markExhausted(
    tenantId: string,
    teamId: string,
    providerId: string,
    message: string,
    headers?: Record<string, string>,
  ): Promise<void> {
    const snapshot = await this.applyFailure(tenantId, teamId, providerId);
    const failures = snapshot.consecutiveFailures;

    const headerRecovery = headers ? this.resolveRateLimitRecovery(headers) : null;
    const backoffMs = Math.min(
      this.rateLimitCooldownMs() * 2 ** Math.max(failures - 1, 0),
      this.cooldownMaxMs(),
    );
    const exhaustedUntil =
      headerRecovery ?? new Date(Date.now() + backoffMs);

    await this.providerUsageModel
      .updateOne(
        { _id: snapshot._id },
        {
          $set: {
            exhaustedUntil,
            errorMessage: message,
            lastStatus: ProviderUsageStatus.EXHAUSTED,
            fetchedAt: new Date(),
          },
        },
      )
      .exec();
  }

  /**
   * Record a channel failure (5xx / 408 / network error).
   * When consecutive failures reach the threshold, the channel enters a
   * circuit-breaker cooldown with exponential backoff.
   */
  async recordFailure(
    tenantId: string,
    teamId: string,
    providerId: string,
    reason: string,
  ): Promise<void> {
    const snapshot = await this.applyFailure(tenantId, teamId, providerId);
    const failures = snapshot.consecutiveFailures;

    const update: Record<string, unknown> = {
      errorMessage: reason,
      lastStatus: ProviderUsageStatus.ERROR,
      fetchedAt: new Date(),
    };

    const threshold = this.failureThreshold();
    if (failures >= threshold) {
      const backoffMs = Math.min(
        this.cooldownBaseMs() * 2 ** (failures - threshold),
        this.cooldownMaxMs(),
      );
      update.cooldownUntil = new Date(Date.now() + backoffMs);
      this.logger.warn(
        `Provider ${providerId} entered cooldown (${backoffMs}ms) after ${failures} consecutive failures`,
      );
    }

    await this.providerUsageModel
      .updateOne({ _id: snapshot._id }, { $set: update })
      .exec();
  }

  /**
   * Reset channel health after a successful upstream request.
   */
  async recordSuccess(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<void> {
    await this.providerUsageModel
      .updateOne(
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
          providerId: new Types.ObjectId(providerId),
        },
        {
          $set: {
            consecutiveFailures: 0,
            exhaustedUntil: null,
            cooldownUntil: null,
            errorMessage: null,
            lastStatus: ProviderUsageStatus.OK,
            fetchedAt: new Date(),
          },
          $setOnInsert: {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
            providerId: new Types.ObjectId(providerId),
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /**
   * Update provider usage from upstream response headers.
   * Extract rate-limit info from common headers.
   */
  async updateFromHeaders(
    tenantId: string,
    teamId: string,
    providerId: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const remaining = this.parseRateLimitHeader(
      headers,
      ['x-ratelimit-remaining-requests', 'x-ratelimit-remaining-tokens'],
    );
    const reset = this.parseRateLimitHeader(
      headers,
      ['x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens'],
    );

    if (remaining === null && reset === null) return;

    await this.providerUsageModel
      .updateOne(
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
          providerId: new Types.ObjectId(providerId),
        },
        {
          $set: {
            rateLimitRemaining: remaining ?? null,
            rateLimitReset: reset ? new Date(reset * 1000) : null,
            fetchedAt: new Date(),
          },
          $setOnInsert: {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
            providerId: new Types.ObjectId(providerId),
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /**
   * Get usage snapshots for all providers in a team (for list display).
   */
  async getTeamProviderUsages(
    tenantId: string,
    teamId: string,
  ): Promise<ProviderUsageView[]> {
    const docs = await this.providerUsageModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
      })
      .sort({ fetchedAt: -1 })
      .exec();
    const providerIds = docs.map((d) => String(d.providerId));
    const providers = await this.providerModel
      .find({ _id: { $in: providerIds.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const nameMap = new Map(providers.map((p) => [String(p._id), p.name]));

    return docs.map((doc) =>
      this.toView(doc, nameMap.get(String(doc.providerId)) ?? null),
    );
  }

  /**
   * Increment the consecutive failure counter and return the updated snapshot.
   */
  private async applyFailure(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderUsageDocument> {
    const doc = await this.providerUsageModel
      .findOneAndUpdate(
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
          providerId: new Types.ObjectId(providerId),
        },
        {
          $inc: { consecutiveFailures: 1 },
          $setOnInsert: {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
            providerId: new Types.ObjectId(providerId),
            fetchedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!doc) {
      throw new Error('Failed to upsert ProviderUsage');
    }
    return doc;
  }

  private async findSnapshot(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderUsageDocument | null> {
    return this.providerUsageModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        providerId: new Types.ObjectId(providerId),
      })
      .exec();
  }

  /**
   * Resolve the 429 recovery deadline from response headers.
   * Supports Retry-After (seconds) and x-ratelimit-reset-* (epoch seconds).
   */
  private resolveRateLimitRecovery(
    headers: Record<string, string>,
  ): Date | null {
    const retryAfter = this.parseRateLimitHeader(headers, ['retry-after']);
    if (retryAfter !== null) {
      return new Date(Date.now() + retryAfter * 1000);
    }
    const reset = this.parseRateLimitHeader(headers, [
      'x-ratelimit-reset-requests',
      'x-ratelimit-reset-tokens',
    ]);
    if (reset !== null) {
      const resetDate = new Date(reset * 1000);
      if (resetDate.getTime() > Date.now()) return resetDate;
    }
    return null;
  }

  private parseRateLimitHeader(
    headers: Record<string, string>,
    names: string[],
  ): number | null {
    for (const name of names) {
      const value = headers[name.toLowerCase()] ?? headers[name];
      if (value !== undefined) {
        const num = Number(value);
        if (Number.isFinite(num) && num >= 0) return num;
      }
    }
    return null;
  }

  private toView(
    doc: ProviderUsageDocument,
    providerName: string | null,
  ): ProviderUsageView {
    return {
      providerId: String(doc.providerId),
      providerName: providerName ?? '未知渠道',
      rateLimitRemaining: doc.rateLimitRemaining,
      rateLimitReset: doc.rateLimitReset?.toISOString() ?? null,
      exhaustedUntil: doc.exhaustedUntil?.toISOString() ?? null,
      cooldownUntil: doc.cooldownUntil?.toISOString() ?? null,
      consecutiveFailures: doc.consecutiveFailures,
      errorMessage: doc.errorMessage,
      lastStatus: doc.lastStatus,
      fetchedAt: doc.fetchedAt.toISOString(),
    };
  }

  private failureThreshold(): number {
    return (
      this.configService.get<number>('providerHealth.failureThreshold') ??
      DEFAULT_FAILURE_THRESHOLD
    );
  }

  private cooldownBaseMs(): number {
    return (
      this.configService.get<number>('providerHealth.cooldownBaseMs') ??
      DEFAULT_COOLDOWN_BASE_MS
    );
  }

  private cooldownMaxMs(): number {
    return (
      this.configService.get<number>('providerHealth.cooldownMaxMs') ??
      DEFAULT_COOLDOWN_MAX_MS
    );
  }

  private rateLimitCooldownMs(): number {
    return (
      this.configService.get<number>('providerHealth.rateLimitCooldownMs') ??
      DEFAULT_RATE_LIMIT_COOLDOWN_MS
    );
  }
}
