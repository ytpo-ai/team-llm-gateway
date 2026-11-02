import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { UsageService } from './usage.service.js';
import { UsageStatus } from './schemas/usage-log.schema.js';

describe('UsageService', () => {
  let service: UsageService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const memberId = String(new Types.ObjectId());
  const otherId = String(new Types.ObjectId());
  const apiKeyId = new Types.ObjectId();
  const providerId = new Types.ObjectId();

  const usageLogModel = {
    create: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  };
  const userModel = {
    find: vi.fn(),
  };
  const apiKeyModel = {
    find: vi.fn(),
  };

  const adminUser: AuthUser = {
    id: memberId,
    email: 'admin@example.com',
    tenantId,
    teamId,
    role: Role.TEAM_ADMIN,
  };
  const memberUser: AuthUser = {
    id: memberId,
    email: 'member@example.com',
    tenantId,
    teamId,
    role: Role.MEMBER,
  };

  const recordInput = {
    tenantId,
    teamId,
    userId: memberId,
    apiKeyId: String(apiKeyId),
    providerId: String(providerId),
    modelId: 'gpt-4o-mini',
    requestId: 'req-1',
    status: UsageStatus.SUCCESS,
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    multiplier: 1.5,
    cost: 22.5,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        { provide: 'UsageLogModel', useValue: usageLogModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'ApiKeyModel', useValue: apiKeyModel },
      ],
    }).compile();

    service = module.get(UsageService);
  });

  describe('record', () => {
    it('should persist with ObjectId fields and snapshot cost', async () => {
      usageLogModel.create.mockResolvedValue({ ...recordInput, _id: new Types.ObjectId() });

      await service.record(recordInput);

      const persisted = usageLogModel.create.mock.calls[0][0];
      expect(persisted.tenantId).toBeInstanceOf(Types.ObjectId);
      expect(persisted.modelId).toBe('gpt-4o-mini');
      expect(persisted.cost).toBe(22.5);
      expect(persisted.totalTokens).toBe(15);
    });
  });

  describe('summary', () => {
    it('should scope to team for admin', async () => {
      usageLogModel.aggregate.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          {
            requestCount: 3,
            totalTokens: 45,
            promptTokens: 30,
            completionTokens: 15,
            totalCost: 67.5,
          },
        ]),
      });

      const result = await service.summary(adminUser, {});

      expect(result.requestCount).toBe(3);
      const match = usageLogModel.aggregate.mock.calls[0][0][0].$match;
      expect(match.teamId).toBeInstanceOf(Types.ObjectId);
      expect(match.userId).toBeUndefined();
    });

    it('should restrict to self for member', async () => {
      usageLogModel.aggregate.mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      });

      await service.summary(memberUser, {});

      const match = usageLogModel.aggregate.mock.calls[0][0][0].$match;
      expect(String(match.userId)).toBe(memberId);
    });
  });

  describe('trends', () => {
    it('should map buckets to ISO strings', async () => {
      const bucket = new Date('2026-10-29T00:00:00.000Z');
      usageLogModel.aggregate.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          {
            _id: bucket,
            requestCount: 2,
            totalTokens: 30,
            totalCost: 45,
          },
        ]),
      });

      const result = await service.trends(adminUser, {});

      expect(result[0].bucket).toBe(bucket.toISOString());
      expect(result[0].totalTokens).toBe(30);
    });
  });

  describe('byMember', () => {
    it('should enrich labels with user names', async () => {
      usageLogModel.aggregate.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          { _id: new Types.ObjectId(memberId), requestCount: 1, totalTokens: 15, totalCost: 22.5 },
          { _id: new Types.ObjectId(otherId), requestCount: 2, totalTokens: 30, totalCost: 45 },
        ]),
      });
      userModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          { _id: new Types.ObjectId(memberId), name: 'Alice', email: 'member@example.com' },
          { _id: new Types.ObjectId(otherId), name: 'Bob', email: 'bob@example.com' },
        ]),
      });

      const result = await service.byMember(adminUser, {});

      expect(result[0].label).toBe('Alice');
      expect(result[1].label).toBe('Bob');
    });
  });

  describe('listLogs', () => {
    const makeDoc = () => ({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(memberId),
      apiKeyId,
      providerId,
      modelId: 'gpt-4o-mini',
      requestId: 'req-1',
      status: UsageStatus.SUCCESS,
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      multiplier: 1.5,
      cost: 22.5,
      latencyMs: 120,
      createdAt: new Date(),
    });

    it('should paginate and scope to team for admin', async () => {
      usageLogModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeDoc()]),
      });
      usageLogModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(1),
      });

      const result = await service.listLogs(adminUser, {});

      expect(result.total).toBe(1);
      expect(result.items[0].modelId).toBe('gpt-4o-mini');
      const filter = usageLogModel.find.mock.calls[0][0];
      expect(filter.teamId).toBeInstanceOf(Types.ObjectId);
    });

    it('should restrict to self for member', async () => {
      usageLogModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });
      usageLogModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(0),
      });

      await service.listLogs(memberUser, {});

      const filter = usageLogModel.find.mock.calls[0][0];
      expect(String(filter.userId)).toBe(memberId);
    });
  });
});
