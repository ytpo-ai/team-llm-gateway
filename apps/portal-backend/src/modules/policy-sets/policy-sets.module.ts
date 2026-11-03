import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  RoleTemplate,
  RoleTemplateSchema,
} from '../role-templates/schemas/role-template.schema.js';
import { SystemModule } from '../system/system.module.js';
import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { PolicySetMigrationService } from './migrations/policy-set-migration.service.js';
import { PolicySetsController } from './policy-sets.controller.js';
import { PolicySetsService } from './policy-sets.service.js';
import { PolicySet, PolicySetSchema } from './schemas/policy-set.schema.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SystemModule,
    MongooseModule.forFeature([
      { name: PolicySet.name, schema: PolicySetSchema },
      { name: Team.name, schema: TeamSchema },
      { name: RoleTemplate.name, schema: RoleTemplateSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
    ]),
  ],
  controllers: [PolicySetsController],
  providers: [PolicySetsService, PolicySetMigrationService],
  exports: [PolicySetsService],
})
export class PolicySetsModule {}
