import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UsageLogDocument = HydratedDocument<UsageLog>;

export enum UsageStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

@Schema({ timestamps: true })
export class UsageLog {
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
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ApiKey',
    required: true,
    index: true,
  })
  apiKeyId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true,
  })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  modelId: string;

  @Prop({ required: true, index: true })
  requestId: string;

  @Prop({
    type: String,
    enum: Object.values(UsageStatus),
    default: UsageStatus.SUCCESS,
  })
  status: UsageStatus;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  promptTokens: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  completionTokens: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalTokens: number;

  @Prop({ type: Number, required: true, default: 1, min: 0 })
  multiplier: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  cost: number;

  @Prop({ type: String, default: null })
  scenario: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  latencyMs: number | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UsageLogSchema = SchemaFactory.createForClass(UsageLog);

UsageLogSchema.index({ tenantId: 1, createdAt: -1 });
UsageLogSchema.index({ tenantId: 1, teamId: 1, createdAt: -1 });
UsageLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
UsageLogSchema.index({ tenantId: 1, apiKeyId: 1, createdAt: -1 });
UsageLogSchema.index({ tenantId: 1, modelId: 1, createdAt: -1 });
UsageLogSchema.index({ requestId: 1 });
