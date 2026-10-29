import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ModelsModule } from './modules/models/models.module.js';
import { ProvidersModule } from './modules/providers/providers.module.js';
import { ProxyModule } from './modules/proxy/proxy.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { UsageModule } from './modules/usage/usage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    AuthModule,
    TeamsModule,
    ApiKeysModule,
    ProvidersModule,
    ModelsModule,
    UsageModule,
    ProxyModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
