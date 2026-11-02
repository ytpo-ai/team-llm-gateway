import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum.js';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
    index: true,
  })
  tenantId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Team', index: true })
  teamId?: Types.ObjectId;

  @Prop({ type: String, lowercase: true, trim: true, default: null })
  email?: string | null;

  @Prop({ type: String, default: null })
  passwordHash?: string | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.MEMBER })
  role: Role;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RoleTemplate',
    default: null,
    index: true,
  })
  roleTemplateId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { tenantId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
