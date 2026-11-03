import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { BillingModule } from '../billing/billing.module.js';
import { Model, ModelSchema } from '../models/schemas/model.schema.js';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema.js';
import { UsageModule } from '../usage/usage.module.js';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard.js';
import { ConcurrencyService } from './concurrency.service.js';
import { ProxyController } from './proxy.controller.js';
import { ProxyService } from './proxy.service.js';
import { RateLimitService } from './rate-limit.service.js';

@Module({
  imports: [
    UsageModule,
    BillingModule,
    MongooseModule.forFeature([
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: Model.name, schema: ModelSchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    ApiKeyAuthGuard,
    RateLimitService,
    ConcurrencyService,
  ],
  exports: [ProxyService],
})
export class ProxyModule {}
