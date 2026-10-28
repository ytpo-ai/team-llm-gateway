import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

@Schema({ timestamps: true })
export class ApiKey {
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

  @Prop({ type: String, trim: true, default: null })
  name: string | null;

  @Prop({ required: true })
  keyHash: string;

  @Prop({ required: true })
  keyPrefix: string;

  @Prop({
    type: String,
    enum: Object.values(ApiKeyStatus),
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: [String], default: [] })
  allowedModels: string[];

  @Prop({ type: Number, default: null })
  rateLimitPerMinute: number | null;

  @Prop({ type: Number, default: null })
  maxTokens: number | null;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

ApiKeySchema.index({ keyHash: 1 }, { unique: true });
ApiKeySchema.index({ tenantId: 1, userId: 1 });
