import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemModule } from '../system/system.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
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
    MongooseModule.forFeature([
      { name: QuotaAccount.name, schema: QuotaAccountSchema },
      { name: QuotaTransaction.name, schema: QuotaTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
