import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

export enum ProviderType {
  OPENAI_COMPATIBLE = 'openai-compatible',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
}

export enum ProviderAuthType {
  API_KEY = 'api-key',
  OAUTH = 'oauth',
}

export enum ProviderStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Schema({ timestamps: true })
export class Provider {
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

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(ProviderType),
    default: ProviderType.OPENAI_COMPATIBLE,
  })
  type: ProviderType;

  @Prop({
    type: String,
    enum: Object.values(ProviderAuthType),
    default: ProviderAuthType.API_KEY,
  })
  authType: ProviderAuthType;

  @Prop({ required: true, trim: true })
  baseUrl: string;

  @Prop({ required: true })
  apiKeyCiphertext: string;

  @Prop({ required: true })
  apiKeyHint: string;

  @Prop({
    type: String,
    enum: Object.values(ProviderStatus),
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus;

  @Prop({ type: String, trim: true, index: true })
  presetKey?: string;

  @Prop({ type: Number, min: 0, max: 2, default: 0 })
  defaultPriority: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);

ProviderSchema.index({ tenantId: 1, teamId: 1, name: 1 }, { unique: true });
ProviderSchema.index({ tenantId: 1, teamId: 1 });
