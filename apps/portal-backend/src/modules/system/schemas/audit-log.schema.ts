import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DISABLE = 'disable',
  ENABLE = 'enable',
  DELETE = 'delete',
  REVOKE = 'revoke',
  ROTATE = 'rotate',
  RECHARGE = 'recharge',
  ADJUST = 'adjust',
  INVITE = 'invite',
  INVITE_REVOKE = 'invite_revoke',
  MEMBER_UPDATE = 'member_update',
  MEMBER_REMOVE = 'member_remove',
  CURRENCY_UPDATE = 'currency_update',
}

export enum AuditResourceType {
  BILLING = 'billing',
  API_KEY = 'api_key',
  MODEL = 'model',
  PROVIDER = 'provider',
  TEAM = 'team',
  MEMBER = 'member',
  INVITATION = 'invitation',
  ROLE_TEMPLATE = 'role_template',
  CURRENCY = 'currency',
  POLICY_SET = 'policy_set',
}

@Schema({ timestamps: true })
export class AuditLog {
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

  @Prop({
    type: String,
    enum: Object.values(AuditAction),
    required: true,
    index: true,
  })
  action: AuditAction;

  @Prop({
    type: String,
    enum: Object.values(AuditResourceType),
    required: true,
    index: true,
  })
  resourceType: AuditResourceType;

  @Prop({ type: String, default: null })
  resourceId: string | null;

  @Prop({ type: String, default: null })
  summary: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  before: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  after: unknown;

  @Prop({ type: String, default: null })
  ip: string | null;

  @Prop({ type: String, default: null })
  userAgent: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, teamId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, resourceType: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
