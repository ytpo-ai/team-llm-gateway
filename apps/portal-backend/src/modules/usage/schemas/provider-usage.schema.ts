import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProviderUsageDocument = HydratedDocument<ProviderUsage>;

export enum ProviderUsageStatus {
  OK = 'ok',
  EXHAUSTED = 'exhausted',
  ERROR = 'error',
}

export enum QuotaUnit {
  TOKEN = 'token',
  REQUEST = 'request',
  SECOND = 'second',
  USD = 'usd',
}

@Schema({ timestamps: true })
export class ProviderUsage {
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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true,
  })
  providerId: Types.ObjectId;

  @Prop({ type: Number, default: null })
  quotaTotal: number | null;

  @Prop({ type: Number, default: null })
  quotaUsed: number | null;

  @Prop({
    type: String,
    enum: Object.values(QuotaUnit),
    default: null,
  })
  quotaUnit: QuotaUnit | null;

  @Prop({ type: Number, default: null })
  rateLimitRemaining: number | null;

  @Prop({ type: Date, default: null })
  rateLimitReset: Date | null;

  @Prop({ type: Boolean, default: false })
  isExhausted: boolean;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({
    type: String,
    enum: Object.values(ProviderUsageStatus),
    default: ProviderUsageStatus.OK,
  })
  lastStatus: ProviderUsageStatus;

  @Prop({ type: Date, required: true })
  fetchedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProviderUsageSchema = SchemaFactory.createForClass(ProviderUsage);

ProviderUsageSchema.index(
  { tenantId: 1, teamId: 1, providerId: 1 },
  { unique: true },
);
ProviderUsageSchema.index({ fetchedAt: 1 });