import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { BillingModule } from '../billing/billing.module.js';
import { Model, ModelSchema } from '../models/schemas/model.schema.js';
import {
  PolicySet,
  PolicySetSchema,
} from '../policy-sets/schemas/policy-set.schema.js';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema.js';
import {
  RoleTemplate,
  RoleTemplateSchema,
} from '../role-templates/schemas/role-template.schema.js';
import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsageModule } from '../usage/usage.module.js';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard.js';
import { ConcurrencyService } from './concurrency.service.js';
import { MemoryMeterBackend } from './memory-meter-backend.js';
import { METER_BACKEND_TOKEN } from './meter-backend.interface.js';
import { PolicyResolver } from './policy-resolver.service.js';
import { ProxyController } from './proxy.controller.js';
import { ProxyService } from './proxy.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { RedisMeterBackend } from './redis-meter-backend.js';

@Module({
  imports: [
    UsageModule,
    BillingModule,
    MongooseModule.forFeature([
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: Model.name, schema: ModelSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: PolicySet.name, schema: PolicySetSchema },
      { name: RoleTemplate.name, schema: RoleTemplateSchema },
      { name: Team.name, schema: TeamSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    PolicyResolver,
    ApiKeyAuthGuard,
    RateLimitService,
    ConcurrencyService,
    {
      provide: METER_BACKEND_TOKEN,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          return new RedisMeterBackend(redisUrl);
        }
        return new MemoryMeterBackend();
      },
    },
  ],
  exports: [ProxyService, PolicyResolver],
})
export class ProxyModule {}
