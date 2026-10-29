import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SystemSettingDocument = HydratedDocument<SystemSetting>;

@Schema({ timestamps: true })
export class SystemSetting {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: unknown;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  updatedBy: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SystemSettingSchema = SchemaFactory.createForClass(SystemSetting);

SystemSettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });
