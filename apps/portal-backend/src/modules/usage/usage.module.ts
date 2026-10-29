import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsageLog, UsageLogSchema } from './schemas/usage-log.schema.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      { name: UsageLog.name, schema: UsageLogSchema },
      { name: User.name, schema: UserSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
    ]),
  ],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
