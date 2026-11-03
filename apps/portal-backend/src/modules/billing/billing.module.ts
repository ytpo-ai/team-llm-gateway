import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PolicySet,
  PolicySetSchema,
} from '../policy-sets/schemas/policy-set.schema.js';
import {
  RoleTemplate,
  RoleTemplateSchema,
} from '../role-templates/schemas/role-template.schema.js';
import { SystemModule } from '../system/system.module.js';
import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsageModule } from '../usage/usage.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { QuotaLimitService } from './quota-limit.service.js';
import {
  QuotaAccount,
  QuotaAccountSchema,
} from './schemas/quota-account.schema.js';
import {
  QuotaTransaction,
  QuotaTransactionSchema,
} from './schemas/quota-transaction.schema.js';

@Module({
  imports: [
    SystemModule,
    UsageModule,
    MongooseModule.forFeature([
      { name: QuotaAccount.name, schema: QuotaAccountSchema },
      { name: QuotaTransaction.name, schema: QuotaTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
      { name: RoleTemplate.name, schema: RoleTemplateSchema },
      { name: PolicySet.name, schema: PolicySetSchema },
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService, QuotaLimitService],
  exports: [BillingService, QuotaLimitService],
})
export class BillingModule {}
