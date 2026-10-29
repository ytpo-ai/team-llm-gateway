import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuotaAccountDocument = HydratedDocument<QuotaAccount>;

export enum QuotaAccountType {
  TEAM = 'team',
  MEMBER = 'member',
}

export enum QuotaAccountStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
}

@Schema({ timestamps: true })
export class QuotaAccount {
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
    type: String,
    enum: Object.values(QuotaAccountType),
    required: true,
  })
  type: QuotaAccountType;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  balance: number;

  @Prop({
    type: String,
    enum: Object.values(QuotaAccountStatus),
    default: QuotaAccountStatus.ACTIVE,
  })
  status: QuotaAccountStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuotaAccountSchema = SchemaFactory.createForClass(QuotaAccount);

QuotaAccountSchema.index(
  { tenantId: 1, teamId: 1, type: 1, userId: 1 },
  { unique: true },
);
