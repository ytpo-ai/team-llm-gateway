import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { QuotaAccountType } from './quota-account.schema.js';

export type QuotaTransactionDocument = HydratedDocument<QuotaTransaction>;

export enum QuotaTransactionType {
  RECHARGE = 'recharge',
  ADJUSTMENT = 'adjustment',
  DEDUCTION = 'deduction',
}

export enum QuotaTransactionSource {
  RECHARGE = 'recharge',
  MANUAL = 'manual',
  USAGE = 'usage',
}

@Schema({ timestamps: true })
export class QuotaTransaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true,
  })
  teamId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'QuotaAccount',
    required: true,
    index: true,
  })
  accountId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(QuotaAccountType),
    required: true,
  })
  accountType: QuotaAccountType;

  @Prop({
    type: String,
    enum: Object.values(QuotaTransactionType),
    required: true,
  })
  type: QuotaTransactionType;

  @Prop({
    type: String,
    enum: Object.values(QuotaTransactionSource),
    required: true,
  })
  source: QuotaTransactionSource;

  @Prop({ type: Number, required: true, default: 0 })
  amount: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  balanceAfter: number;

  @Prop({ type: Boolean, default: false })
  shortfall: boolean;

  @Prop({ type: String, default: null })
  referenceId: string | null;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: Number, default: null })
  totalTokens: number | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuotaTransactionSchema =
  SchemaFactory.createForClass(QuotaTransaction);

QuotaTransactionSchema.index({ tenantId: 1, createdAt: -1 });
QuotaTransactionSchema.index({ tenantId: 1, teamId: 1, createdAt: -1 });
QuotaTransactionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
QuotaTransactionSchema.index({ accountId: 1, createdAt: -1 });
