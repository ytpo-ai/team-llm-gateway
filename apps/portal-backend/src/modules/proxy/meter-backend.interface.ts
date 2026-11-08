import { Measure, Window } from './protocol/types.js';

/** Injection token for MeterBackend (NestJS interfaces cannot be used as direct tokens). */
export const METER_BACKEND_TOKEN = Symbol('MeterBackend');

/** Scope identifier for a metered subject. */
export interface MeterScope {
  kind: 'team' | 'member' | 'key';
  id: string;
}

/**
 * Abstract counting backend for ProxyCore.
 *
 * All limits (rate, token, spend, concurrency) flow through this interface.
 * Implementations may use in-memory counters (MemoryMeterBackend) or
 * Redis (RedisMeterBackend) for distributed deployments.
 */
export interface MeterBackend {
  /**
   * Check whether {@link scope} is still under {@link limit} for the given
   * measure × window combination. Returns true when the request is allowed.
   */
  checkLimit(
    scope: MeterScope,
    measure: Measure,
    window: Window,
    limit: number,
  ): Promise<boolean>;

  /**
   * Increment the counter for {@link scope} by {@link amount}.
   * Must be called after a successful request to keep the counter accurate.
   */
  increment(
    scope: MeterScope,
    measure: Measure,
    window: Window,
    amount: number,
  ): Promise<void>;

  /**
   * Acquire a concurrency slot for the given key.
   * Returns a release function. Throws if the limit is already reached.
   */
  acquireConcurrency(key: string, limit: number): () => Promise<void>;
}