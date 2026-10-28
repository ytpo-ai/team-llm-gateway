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
});
