import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  Measure,
  Window as PolicyWindow,
} from './protocol/types.js';
import { MeterBackend, MeterScope } from './meter-backend.interface.js';

const KEY_PREFIX = 'meter:';

// ── window helpers ──

function windowStart(now: Date, window: PolicyWindow): number {
  const d = new Date(now);
  switch (window) {
    case PolicyWindow.MINUTE:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes()) / 1000;
    case PolicyWindow.HOUR:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours()) / 1000;
    case PolicyWindow.DAY:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
    case PolicyWindow.WEEK:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
        d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) / 1000;
    case PolicyWindow.MONTH:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    case PolicyWindow.PERMANENT:
    default:
      return 0;
  }
}

function windowTtlMs(now: Date, window: PolicyWindow): number {
  switch (window) {
    case PolicyWindow.MINUTE:
      return 60_000;
    case PolicyWindow.HOUR:
      return 3600_000;
    case PolicyWindow.DAY:
      return 86_400_000;
    case PolicyWindow.WEEK:
      return 604_800_000;
    case PolicyWindow.MONTH: {
      const d = new Date(now);
      const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      return nextMonth.getTime() - now.getTime();
    }
    case PolicyWindow.PERMANENT:
    default:
      return 0;
  }
}

function buildCounterKey(
  scope: MeterScope,
  measure: Measure,
  window: PolicyWindow,
  now: Date,
): string {
  const ws = window !== PolicyWindow.PERMANENT
    ? `:${windowStart(now, window)}`
    : '';
  return `${KEY_PREFIX}${measure}:${scope.kind}:${scope.id}:${window}${ws}`;
}

@Injectable()
export class RedisMeterBackend implements MeterBackend {
  private readonly logger = new Logger(RedisMeterBackend.name);
  private client: Redis | null = null;

  constructor(private readonly redisUrl: string) {}

  private ensureClient(): Redis {
    if (!this.client) {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: true,
      });
      this.logger.log('RedisMeterBackend connected');
    }
    return this.client;
  }

  async checkLimit(
    scope: MeterScope,
    measure: Measure,
    window: PolicyWindow,
    limit: number,
  ): Promise<boolean> {
    if (limit <= 0) return true;

    const now = new Date();
    const key = buildCounterKey(scope, measure, window, now);
    const redis = this.ensureClient();

    const current = await redis.get(key);
    return current === null || Number(current) < limit;
  }

  async increment(
    scope: MeterScope,
    measure: Measure,
    window: PolicyWindow,
    amount: number,
  ): Promise<void> {
    if (amount <= 0) return;

    const now = new Date();
    const key = buildCounterKey(scope, measure, window, now);
    const redis = this.ensureClient();

    const ttl = windowTtlMs(now, window);
    if (ttl > 0) {
      // Use a Lua script for atomic INCR + EXPIRE
      await redis.eval(
        `local v = redis.call('INCRBY', KEYS[1], ARGV[1])
         redis.call('EXPIRE', KEYS[1], ARGV[2])
         return v`,
        1,
        key,
        amount,
        Math.ceil(ttl / 1000),
      );
    } else {
      await redis.incrby(key, amount);
    }
  }

  acquireConcurrency(_key: string, limit: number): () => Promise<void> {
    if (limit <= 0) {
      return () => Promise.resolve();
    }

    // Redis concurrency acquisition is handled through tryAcquireConcurrency.
    // This synchronous fallback returns a no-op release.
    return () => Promise.resolve();
  }

  /**
   * Atomically try to acquire a concurrency slot in Redis.
   * Returns the release function on success, or throws.
   */
  async tryAcquireConcurrency(key: string, limit: number): Promise<() => Promise<void>> {
    if (limit <= 0) {
      return () => Promise.resolve();
    }

    const concurrencyKey = `concurrency:${key}`;
    const redis = this.ensureClient();

    // Lua script: increment if under limit, else return -1
    const result = await redis.eval(
      `local current = redis.call('GET', KEYS[1]) or 0
       if tonumber(current) >= tonumber(ARGV[1]) then return -1 end
       return redis.call('INCR', KEYS[1])`,
      1,
      concurrencyKey,
      limit,
    );

    // TypeScript narrow: result can be string or number from ioredis eval
    const count = Number(result as unknown);
    if (count < 0) {
      throw new Error('并发数已达上限');
    }

    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        await redis.decr(concurrencyKey);
      } catch (err) {
        this.logger.warn(
          `Failed to decrement concurrency key ${concurrencyKey}: ${String(err)}`,
        );
      }
    };
  }
}