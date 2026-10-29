import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { Tenant, TenantSchema } from '../tenant/schemas/tenant.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsageLog, UsageLogSchema } from '../usage/schemas/usage-log.schema.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SuperAdminBootstrapService } from './super-admin-bootstrap.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Team.name, schema: TeamSchema },
      { name: User.name, schema: UserSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: UsageLog.name, schema: UsageLogSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminBootstrapService],
})
export class AdminModule {}
