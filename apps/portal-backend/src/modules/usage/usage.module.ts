import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  ProviderUsage,
  ProviderUsageSchema,
} from './schemas/provider-usage.schema.js';
import { UsageLog, UsageLogSchema } from './schemas/usage-log.schema.js';
import { ProviderUsageService } from './provider-usage.service.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      { name: UsageLog.name, schema: UsageLogSchema },
      { name: User.name, schema: UserSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: ProviderUsage.name, schema: ProviderUsageSchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  controllers: [UsageController],
  providers: [UsageService, ProviderUsageService],
  exports: [UsageService, ProviderUsageService],
})
export class UsageModule {}
