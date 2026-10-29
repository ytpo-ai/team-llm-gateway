import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuditService } from './audit.service.js';
import {
  AuditAction,
  AuditResourceType,
} from './schemas/audit-log.schema.js';

describe('AuditService', () => {
  let service: AuditService;

  const tenantId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const auditLogModel = {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: 'AuditLogModel', useValue: auditLogModel },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  describe('log', () => {
    it('should create an audit log document', async () => {
      auditLogModel.create.mockResolvedValue({});

      await service.log({
        tenantId: String(tenantId),
        teamId: String(teamId),
        actorUserId: String(userId),
        action: AuditAction.CREATE,
        resourceType: AuditResourceType.API_KEY,
        resourceId: 'key-1',
        summary: '创建 API Key',
      });

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: expect.any(Types.ObjectId),
          teamId: expect.any(Types.ObjectId),
          userId: expect.any(Types.ObjectId),
          action: AuditAction.CREATE,
          resourceType: AuditResourceType.API_KEY,
          resourceId: 'key-1',
          summary: '创建 API Key',
        }),
      );
    });

    it('should swallow write failures without throwing', async () => {
      auditLogModel.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.log({
          tenantId: String(tenantId),
          teamId: String(teamId),
          actorUserId: String(userId),
          action: AuditAction.REVOKE,
          resourceType: AuditResourceType.API_KEY,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should apply tenant/team filter and pagination', async () => {
      const doc = {
        _id: new Types.ObjectId(),
        userId,
        action: AuditAction.CREATE,
        resourceType: AuditResourceType.MODEL,
        resourceId: 'm-1',
        summary: '创建模型',
        ip: null,
        createdAt: new Date(),
      };
      auditLogModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([doc]),
      });
      auditLogModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(1),
      });

      const result = await service.list(String(tenantId), String(teamId), {
        action: AuditAction.CREATE,
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(String(doc._id));

      const filter = auditLogModel.find.mock.calls[0][0];
      expect(filter.tenantId).toEqual(tenantId);
      expect(filter.teamId).toEqual(teamId);
      expect(filter.action).toBe(AuditAction.CREATE);
    });
  });
});
