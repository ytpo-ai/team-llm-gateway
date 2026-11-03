import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PolicySetDocument = HydratedDocument<PolicySet>;

export enum PolicyMeasure {
  TOKEN = 'token',
  REQUEST = 'request',
  CONCURRENCY = 'concurrency',
  SPEND = 'spend',
}

export enum PolicyWindow {
  PERMANENT = 'permanent',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export enum PolicyAction {
  BLOCK = 'block',
  WARN = 'warn',
}

@Schema({ _id: false })
export class PolicyEntry {
  @Prop({
    type: String,
    enum: Object.values(PolicyMeasure),
    required: true,
  })
  measure: PolicyMeasure;

  @Prop({
    type: String,
    enum: Object.values(PolicyWindow),
    required: true,
  })
  window: PolicyWindow;

  @Prop({ type: Number, required: true, min: 0 })
  limit: number;

  @Prop({
    type: String,
    enum: Object.values(PolicyAction),
    required: true,
  })
  action: PolicyAction;
}

export const PolicyEntrySchema = SchemaFactory.createForClass(PolicyEntry);

@Schema({ timestamps: true })
export class PolicySet {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
    index: true,
  })
  tenantId?: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Team',
    default: null,
    index: true,
  })
  teamId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true, default: '' })
  description: string;

  @Prop({ type: [PolicyEntrySchema], default: [] })
  entries: PolicyEntry[];

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'Provider',
    default: [],
  })
  providerIds: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  modelWhitelist: string[];

  @Prop({ type: Boolean, default: false })
  builtIn: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PolicySetSchema = SchemaFactory.createForClass(PolicySet);

PolicySetSchema.index({ tenantId: 1, teamId: 1 });
