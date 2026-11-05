import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ModelDocument = HydratedDocument<Model>;

export enum ModelStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Schema({ _id: false })
export class ProviderBinding {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  })
  providerId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0 })
  priority: number;
}

export const ProviderBindingSchema =
  SchemaFactory.createForClass(ProviderBinding);

@Schema({ timestamps: true })
export class Model {
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

  @Prop({ type: [ProviderBindingSchema], default: [] })
  providerBindings: ProviderBinding[];

  @Prop({ required: true, trim: true })
  modelId: string;

  @Prop({ type: String, trim: true, default: '' })
  displayName: string;

  @Prop({ type: Number, required: true, default: 1 })
  multiplier: number;

  @Prop({ type: [String], default: [] })
  capabilities: string[];

  @Prop({ type: [String], default: [] })
  aliases: string[];

  @Prop({
    type: String,
    enum: Object.values(ModelStatus),
    default: ModelStatus.ACTIVE,
  })
  status: ModelStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ModelSchema = SchemaFactory.createForClass(Model);

ModelSchema.index(
  { tenantId: 1, teamId: 1, modelId: 1 },
  { unique: true },
);
ModelSchema.index({ tenantId: 1, teamId: 1, providerId: 1 });
