import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { decrypt } from '../../common/crypto/cipher.js';
import {
  Provider,
  ProviderStatus,
} from '../providers/schemas/provider.schema.js';
import { resolveAdapter } from '../proxy/adapters/adapter.factory.js';
import type { ProviderUsageSnapshot } from '../proxy/adapters/upstream-adapter.js';
import {
  ProviderUsage,
  ProviderUsageDocument,
  ProviderUsageStatus,
} from './schemas/provider-usage.schema.js';

export interface ProviderUsageView {
  providerId: string;
  providerName: string;
  quotaTotal: number | null;
  quotaUsed: number | null;
  quotaUnit: string | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  isExhausted: boolean;
  errorMessage: string | null;
  lastStatus: string;
  fetchedAt: string;
}

const DEFAULT_CACHE_TTL_MS = 30_000; // 30s

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
   * Query upstream provider usage and cache the snapshot.
   * Falls back to a generic HTTP GET on usageEndpoint if the adapter does not implement fetchUsage.
   * Returns null only if the provider cannot be queried at all.
   */
  async fetchAndCache(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderUsageDocument | null> {
    const provider = await this.providerModel
      .findOne({
        _id: new Types.ObjectId(providerId),
        tenantId,
        teamId,
        status: ProviderStatus.ACTIVE,
      })
      .exec();
    if (!provider) return null;

    const secret = this.configService.getOrThrow<string>('encryption.secret');
    const apiKey = decrypt(secret, provider.apiKeyCiphertext);

    let snapshot: ProviderUsageSnapshot | null = null;

    // 1. Try adapter-specific fetchUsage
    const adapter = resolveAdapter(provider.type);
    if (adapter.fetchUsage) {
      try {
        snapshot = await adapter.fetchUsage(
          provider.baseUrl,
          apiKey,
          provider.usageEndpoint ?? undefined,
        );
      } catch (err) {
        this.logger.warn(
          `Adapter fetchUsage failed for ${provider.name}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    // 2. Fallback: generic HTTP GET to usageEndpoint
    if (!snapshot && provider.usageEndpoint) {
      try {
        snapshot = await this.genericFetchUsage(
          provider.usageEndpoint,
          apiKey,
          provider.name,
        );
      } catch (err) {
        this.logger.warn(
          `Generic fetchUsage failed for ${provider.name}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    if (!snapshot) {
      return this.markError(tenantId, teamId, providerId, new Error('无法查询上游用量'));
    }

    return this.upsert(tenantId, teamId, providerId, snapshot);
  }

  /**
   * Generic HTTP GET to a usage endpoint.
   * Tries to parse common upstream usage response formats.
   */
  private async genericFetchUsage(
    endpoint: string,
    apiKey: string,
    providerName: string,
  ): Promise<ProviderUsageSnapshot | null> {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      this.logger.warn(
        `Usage endpoint for ${providerName} returned ${res.status}`,
      );
      return null;
    }

    const body = (await res.json()) as Record<string, unknown>;

    // Try to extract usage data from common response formats
    const data = (body.data ?? body.usage ?? body) as Record<string, unknown>;

    const quotaTotal = this.pickNumber(data, [
      'total', 'quota_total', 'limit',
      'total_available', 'granted',
    ]);
    const quotaUsed = this.pickNumber(data, [
      'used', 'usage', 'quota_used', 'consumed',
      'total_used', 'available',
    ]);
    const quotaRemaining = this.pickNumber(data, [
      'remaining', 'remain', 'quota_remaining',
      'available', 'left',
    ]);
    const rateLimitRemaining = this.pickNumber(data, [
      'rate_limit_remaining', 'rate_remaining',
    ]);

    // Detect unit from response hints
    let quotaUnit: ProviderUsageSnapshot['quotaUnit'] = null;
    const unit = this.pickString(data, ['unit', 'quota_unit', 'type']);
    if (unit) {
      if (unit.includes('second') || unit.includes('time')) quotaUnit = 'second';
      else if (unit.includes('token')) quotaUnit = 'token';
      else if (unit.includes('request')) quotaUnit = 'request';
      else if (unit.includes('usd') || unit.includes('dollar')) quotaUnit = 'usd';
    }

    return {
      quotaTotal,
      quotaUsed,
      quotaRemaining,
      quotaUnit,
      rateLimitRemaining,
      rateLimitReset: null,
    };
  }

  private pickNumber(obj: Record<string, unknown>, names: string[]): number | null {
    for (const name of names) {
      const v = obj[name];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  }

  private pickString(obj: Record<string, unknown>, names: string[]): string | null {
    for (const name of names) {
      const v = obj[name];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  }

  /**
   * Get cached provider usage snapshot.
   * If cache is stale (exceeded TTL), returns null — caller should refetch.
   */
  async getSnapshot(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderUsageDocument | null> {
    const cached = await this.providerUsageModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        providerId: new Types.ObjectId(providerId),
      })
      .exec();
    if (!cached) return null;

    const ttl = this.cacheTtlMs();
    if (Date.now() - cached.fetchedAt.getTime() > ttl) return null;

    return cached;
  }

  /**
   * Check if a provider channel is currently exhausted.
   * Returns false if no cached data (optimistic: assume available).
   */
  async isExhausted(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<boolean> {
    const snapshot = await this.getSnapshot(tenantId, teamId, providerId);
    if (!snapshot) return false;
    return snapshot.isExhausted;
  }

  /**
   * Mark a provider as exhausted (e.g. after receiving 429 from upstream).
   */
  async markExhausted(
    tenantId: string,
    teamId: string,
    providerId: string,
    message: string,
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
            isExhausted: true,
            errorMessage: message,
            lastStatus: ProviderUsageStatus.EXHAUSTED,
            fetchedAt: new Date(),
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

  private parseRateLimitHeader(
    headers: Record<string, string>,
    names: string[],
  ): number | null {
    for (const name of names) {
      const value = headers[name.toLowerCase()] ?? headers[name];
      if (value !== undefined) {
        const num = Number(value);
        if (!Number.isNaN(num)) return num;
      }
    }
    return null;
  }

  private async upsert(
    tenantId: string,
    teamId: string,
    providerId: string,
    snapshot: ProviderUsageSnapshot,
  ): Promise<ProviderUsageDocument> {
    const isExhausted =
      snapshot.quotaRemaining !== null && snapshot.quotaRemaining <= 0;

    const doc = await this.providerUsageModel
      .findOneAndUpdate(
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
          providerId: new Types.ObjectId(providerId),
        },
        {
          $set: {
            quotaTotal: snapshot.quotaTotal ?? null,
            quotaUsed: snapshot.quotaUsed ?? null,
            quotaUnit: snapshot.quotaUnit ?? null,
            rateLimitRemaining: snapshot.rateLimitRemaining ?? null,
            rateLimitReset: snapshot.rateLimitReset ?? null,
            isExhausted,
            errorMessage: isExhausted ? '上游额度已耗尽' : null,
            lastStatus: isExhausted
              ? ProviderUsageStatus.EXHAUSTED
              : ProviderUsageStatus.OK,
            fetchedAt: new Date(),
          },
          $setOnInsert: {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
            providerId: new Types.ObjectId(providerId),
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

  private async markError(
    tenantId: string,
    teamId: string,
    providerId: string,
    err: unknown,
  ): Promise<ProviderUsageDocument | null> {
    const message =
      err instanceof Error ? err.message : '未知错误';

    const doc = await this.providerUsageModel
      .findOneAndUpdate(
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
          providerId: new Types.ObjectId(providerId),
        },
        {
          $set: {
            lastStatus: ProviderUsageStatus.ERROR,
            errorMessage: message,
            fetchedAt: new Date(),
          },
          $setOnInsert: {
            tenantId: new Types.ObjectId(tenantId),
            teamId: new Types.ObjectId(teamId),
            providerId: new Types.ObjectId(providerId),
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    return doc;
  }

  /**
   * Get usage snapshots for all providers in a team.
   * Used by `GET /usage/by-provider` and frontend display.
   */
  async listSnapshots(
    tenantId: string,
    teamId: string,
  ): Promise<ProviderUsageDocument[]> {
    return this.providerUsageModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
      })
      .sort({ fetchedAt: -1 })
      .exec();
  }

  /**
   * Get usage snapshot for a specific provider, with provider name.
   * Includes stale (expired) snapshots so the frontend can show last-known state.
   */
  async getProviderUsage(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<ProviderUsageView | null> {
    const cached = await this.providerUsageModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        providerId: new Types.ObjectId(providerId),
      })
      .exec();
    if (!cached) return null;

    const provider = await this.providerModel
      .findById(providerId)
      .select('name')
      .exec();

    return this.toView(cached, provider?.name ?? null);
  }

  /**
   * Get usage snapshots for all providers in a team (for list display).
   */
  async getTeamProviderUsages(
    tenantId: string,
    teamId: string,
  ): Promise<ProviderUsageView[]> {
    const docs = await this.listSnapshots(tenantId, teamId);
    const providerIds = docs.map((d) => String(d.providerId));
    const providers = await this.providerModel
      .find({ _id: { $in: providerIds.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const nameMap = new Map(providers.map((p) => [String(p._id), p.name]));

    return docs.map((doc) => this.toView(doc, nameMap.get(String(doc.providerId)) ?? null));
  }

  private toView(
    doc: ProviderUsageDocument,
    providerName: string | null,
  ): ProviderUsageView {
    return {
      providerId: String(doc.providerId),
      providerName: providerName ?? '未知渠道',
      quotaTotal: doc.quotaTotal,
      quotaUsed: doc.quotaUsed,
      quotaUnit: doc.quotaUnit,
      rateLimitRemaining: doc.rateLimitRemaining,
      rateLimitReset: doc.rateLimitReset?.toISOString() ?? null,
      isExhausted: doc.isExhausted,
      errorMessage: doc.errorMessage,
      lastStatus: doc.lastStatus,
      fetchedAt: doc.fetchedAt.toISOString(),
    };
  }

  private cacheTtlMs(): number {
    return (
      this.configService.get<number>('providerUsage.cacheTtlMs') ??
      DEFAULT_CACHE_TTL_MS
    );
  }
}