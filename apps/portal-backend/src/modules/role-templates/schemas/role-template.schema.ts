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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'PolicySet',
    default: null,
    index: true,
  })
  policySetId?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false })
  builtIn: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const RoleTemplateSchema = SchemaFactory.createForClass(RoleTemplate);

RoleTemplateSchema.index({ tenantId: 1, teamId: 1, name: 1 });
