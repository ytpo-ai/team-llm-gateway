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

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', ttl: number): Promise<unknown>;
}

export class RedisTokenCache implements TokenCache {
  private client: RedisClientLike | null = null;

  constructor(
    private readonly url: string,
    private readonly keyPrefix = 'gemini:oauth:token:',
  ) {}

  private async ensureClient(): Promise<RedisClientLike> {
    if (this.client) return this.client;
    // ioredis 为可选依赖：仅在配置 REDIS_URL 时才动态加载，部署方需 `pnpm add ioredis`
    const specifier = 'ioredis';
    const mod = (await import(specifier)) as {
      default: new (url: string) => RedisClientLike;
    };
    this.client = new mod.default(this.url);
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.ensureClient();
    return client.get(this.keyPrefix + key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const client = await this.ensureClient();
    await client.set(this.keyPrefix + key, value, 'PX', ttlMs);
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
