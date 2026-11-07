export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  encryption: {
    secret: string;
  };
  superAdmin: {
    email: string;
    password: string;
  };
  modelPresets: {
    url: string;
  };
  providerHealth: {
    failureThreshold: number;
    cooldownBaseMs: number;
    cooldownMaxMs: number;
    rateLimitCooldownMs: number;
  };
}

export default (): AppConfig => ({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/portal',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'portal-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'portal-dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  encryption: {
    secret: process.env.ENCRYPTION_SECRET ?? 'portal-dev-encryption-secret',
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? '',
    password: process.env.SUPER_ADMIN_PASSWORD ?? '',
  },
  modelPresets: {
    url: process.env.MODEL_PRESETS_URL ?? '',
  },
  providerHealth: {
    failureThreshold: Number.parseInt(
      process.env.PROVIDER_FAILURE_THRESHOLD ?? '3',
      10,
    ),
    cooldownBaseMs: Number.parseInt(
      process.env.PROVIDER_COOLDOWN_BASE_MS ?? '30000',
      10,
    ),
    cooldownMaxMs: Number.parseInt(
      process.env.PROVIDER_COOLDOWN_MAX_MS ?? '600000',
      10,
    ),
    rateLimitCooldownMs: Number.parseInt(
      process.env.PROVIDER_RATE_LIMIT_COOLDOWN_MS ?? '60000',
      10,
    ),
  },
});
