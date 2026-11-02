import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TeamDocument = HydratedDocument<Team>;

export enum TeamStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Schema({ timestamps: true })
export class Team {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(TeamStatus),
    default: TeamStatus.ACTIVE,
  })
  status: TeamStatus;

  @Prop({ type: Number, default: null })
  limitDaily?: number | null;

  @Prop({ type: Number, default: null })
  limitWeekly?: number | null;

  @Prop({ type: Number, default: null })
  limitMonthly?: number | null;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'Provider',
    default: [],
  })
  providerIds: Types.ObjectId[];
}

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.index({ tenantId: 1, name: 1 }, { unique: true });
