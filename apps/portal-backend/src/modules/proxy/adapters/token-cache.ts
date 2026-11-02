import { Redis } from 'ioredis';

export interface TokenCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

export class MemoryTokenCache implements TokenCache {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

export class RedisTokenCache implements TokenCache {
  private client: Redis | null = null;

  constructor(
    private readonly url: string,
    private readonly keyPrefix = 'gemini:oauth:token:',
  ) {}

  private ensureClient(): Redis {
    if (!this.client) {
      this.client = new Redis(this.url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.ensureClient().get(this.keyPrefix + key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.ensureClient().set(this.keyPrefix + key, value, 'PX', ttlMs);
  }
}

let cache: TokenCache | undefined;

export function getTokenCache(): TokenCache {
  if (!cache) {
    const redisUrl = process.env.REDIS_URL;
    cache = redisUrl ? new RedisTokenCache(redisUrl) : new MemoryTokenCache();
  }
  return cache;
}

export function clearTokenCache(): void {
  cache = undefined;
}
