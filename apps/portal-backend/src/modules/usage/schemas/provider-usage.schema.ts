import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProviderUsageDocument = HydratedDocument<ProviderUsage>;

export enum ProviderUsageStatus {
  OK = 'ok',
  EXHAUSTED = 'exhausted',
  ERROR = 'error',
}

/**
 * Channel health snapshot, driven by passive signals only:
 * - 429 responses (rate limited → exhaustedUntil)
 * - 5xx/408/network errors (consecutive failures → cooldownUntil)
 * - upstream response headers (rate-limit remaining/reset)
 */
@Schema({ timestamps: true })
export class ProviderUsage {
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

  @Prop({ type: Number, default: null })
  rateLimitRemaining: number | null;

  @Prop({ type: Date, default: null })
  rateLimitReset: Date | null;

  /** 429 rate-limit recovery time; channel is unavailable while > now */
  @Prop({ type: Date, default: null })
  exhaustedUntil: Date | null;

  /** Consecutive failure count (5xx/408/network error/repeated 429) */
  @Prop({ type: Number, default: 0 })
  consecutiveFailures: number;

  /** Circuit-breaker cooldown deadline; channel is unavailable while > now */
  @Prop({ type: Date, default: null })
  cooldownUntil: Date | null;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({
    type: String,
    enum: Object.values(ProviderUsageStatus),
    default: ProviderUsageStatus.OK,
  })
  lastStatus: ProviderUsageStatus;

  @Prop({ type: Date, required: true })
  fetchedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProviderUsageSchema = SchemaFactory.createForClass(ProviderUsage);

ProviderUsageSchema.index(
  { tenantId: 1, teamId: 1, providerId: 1 },
  { unique: true },
);
ProviderUsageSchema.index({ fetchedAt: 1 });
