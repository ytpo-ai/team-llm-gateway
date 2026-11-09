import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Measure, Window } from './protocol/types.js';
import { MeterBackend, MeterScope } from './meter-backend.interface.js';

// ── window helpers ──

function windowStart(now: Date, window: Window): number {
  const d = new Date(now);
  switch (window) {
    case Window.MINUTE:
      return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
      );
    case Window.HOUR:
      return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
      );
    case Window.DAY:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    case Window.WEEK:
      return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() - ((d.getUTCDay() + 6) % 7),
      );
    case Window.MONTH:
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case Window.PERMANENT:
    default:
      return 0;
  }
}

function windowTtlMs(now: Date, window: Window): number {
  switch (window) {
    case Window.MINUTE:
      return 60_000;
    case Window.HOUR:
      return 3_600_000;
    case Window.DAY:
      return 86_400_000;
    case Window.WEEK:
      return 604_800_000;
    case Window.MONTH: {
      const d = new Date(now);
      const nextMonth = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
      );
      return nextMonth.getTime() - now.getTime();
    }
    case Window.PERMANENT:
    default:
      return 0;
  }
}

function counterKey(
  scope: MeterScope,
  measure: Measure,
  window: Window,
  now: Date,
): string {
  const ws =
    window !== Window.PERMANENT ? `:${windowStart(now, window)}` : '';
  return `${measure}:${scope.kind}:${scope.id}:${window}${ws}`;
}

interface CounterEntry {
  value: number;
  createdAt: number;
}

/**
 * In-process MeterBackend backed by JavaScript Maps.
 *
 * Suitable for single-instance deployments where Redis is not configured.
 * Counter state is lost on process restart.
 */
@Injectable()
export class MemoryMeterBackend implements MeterBackend {
  private readonly counters = new Map<string, CounterEntry>();
  private readonly concurrency = new Map<string, number>();

  async checkLimit(
    scope: MeterScope,
    measure: Measure,
    window: Window,
    limit: number,
  ): Promise<boolean> {
    if (limit <= 0) return true;

    const now = Date.now();
    const key = counterKey(scope, measure, window, new Date());
    const entry = this.counters.get(key);

    if (!entry) return true;

    // Evict expired windows
    if (window !== Window.PERMANENT) {
      const ttl = windowTtlMs(new Date(), window);
      if (now - entry.createdAt > ttl) {
        this.counters.delete(key);
        return true;
      }
    }

    return entry.value < limit;
  }

  async increment(
    scope: MeterScope,
    measure: Measure,
    window: Window,
    amount: number,
  ): Promise<void> {
    if (amount <= 0) return;

    const now = Date.now();
    const key = counterKey(scope, measure, window, new Date());
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += amount;
    } else {
      this.counters.set(key, { value: amount, createdAt: now });
    }
  }

  acquireConcurrency(key: string, limit: number): () => Promise<void> {
    if (limit <= 0) {
      return () => Promise.resolve();
    }

    const current = this.concurrency.get(key) ?? 0;
    if (current >= limit) {
      throw new HttpException(
        '并发数已达上限',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.concurrency.set(key, current + 1);
    let released = false;

    return async () => {
      if (released) return;
      released = true;
      const value = this.concurrency.get(key) ?? 1;
      this.concurrency.set(key, Math.max(value - 1, 0));
    };
  }

  /**
   * Async concurrency acquisition compatible with RedisMeterBackend.
   * For in-memory backend this is equivalent to acquireConcurrency.
   */
  async tryAcquireConcurrency(
    key: string,
    limit: number,
  ): Promise<() => Promise<void>> {
    if (limit <= 0) {
      return () => Promise.resolve();
    }

    const current = this.concurrency.get(key) ?? 0;
    if (current >= limit) {
      throw new HttpException(
        '并发数已达上限',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.concurrency.set(key, current + 1);
    let released = false;

    return async () => {
      if (released) return;
      released = true;
      const value = this.concurrency.get(key) ?? 1;
      this.concurrency.set(key, Math.max(value - 1, 0));
    };
  }
}