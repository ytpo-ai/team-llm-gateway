import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type RoleTemplateDocument = HydratedDocument<RoleTemplate>;

@Schema({ timestamps: true })
export class RoleTemplate {
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

  @Prop({ type: Number, default: null })
  limitDaily?: number | null;

  @Prop({ type: Number, default: null })
  limitWeekly?: number | null;

  @Prop({ type: Number, default: null })
  limitMonthly?: number | null;

  @Prop({ type: Number, default: null })
  rateLimitPerMinute?: number | null;

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

export const RoleTemplateSchema = SchemaFactory.createForClass(RoleTemplate);

RoleTemplateSchema.index({ tenantId: 1, teamId: 1, name: 1 });
