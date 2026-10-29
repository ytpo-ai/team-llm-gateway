import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditAction,
  AuditLog,
  AuditLogDocument,
  AuditResourceType,
} from './schemas/audit-log.schema.js';

export interface AuditEntryInput {
  tenantId: string;
  teamId: string;
  actorUserId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditLogView {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  summary: string | null;
  ip: string | null;
  createdAt?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  async log(input: AuditEntryInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        tenantId: new Types.ObjectId(input.tenantId),
        teamId: new Types.ObjectId(input.teamId),
        userId: new Types.ObjectId(input.actorUserId),
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        summary: input.summary ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `审计日志写入失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(
    tenantId: string,
    teamId: string,
    query: {
      action?: AuditAction;
      resourceType?: AuditResourceType;
      userId?: string;
      from?: Date;
      to?: Date;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: AuditLogView[]; total: number; limit: number; offset: number }> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
    };
    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .exec(),
      this.auditLogModel.countDocuments(filter).exec(),
    ]);

    return {
      items: docs.map((doc) => this.toView(doc)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  private toView(doc: AuditLogDocument): AuditLogView {
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      action: doc.action,
      resourceType: doc.resourceType,
      resourceId: doc.resourceId,
      summary: doc.summary,
      ip: doc.ip,
      createdAt: doc.createdAt,
    };
  }
}
