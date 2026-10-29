import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { TenantStatus } from '../tenant/schemas/tenant.schema.js';
import { AdminService } from './admin.service.js';

const execResolved = (value: unknown) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe('AdminService', () => {
  let service: AdminService;

  const tenantId = new Types.ObjectId();

  const tenantModel = {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  };
  const teamModel = {
    create: vi.fn(),
    countDocuments: vi.fn(),
  };
  const userModel = {
    countDocuments: vi.fn(),
  };
  const apiKeyModel = {
    countDocuments: vi.fn(),
  };
  const usageLogModel = {
    aggregate: vi.fn(),
  };

  const mockCounts = (counts: Record<string, number>) => {
    teamModel.countDocuments.mockReturnValue(
      execResolved(counts.team ?? 0),
    );
    userModel.countDocuments.mockReturnValue(
      execResolved(counts.member ?? 0),
    );
    apiKeyModel.countDocuments.mockReturnValue(
      execResolved(counts.key ?? 0),
    );
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: 'TenantModel', useValue: tenantModel },
        { provide: 'TeamModel', useValue: teamModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'ApiKeyModel', useValue: apiKeyModel },
        { provide: 'UsageLogModel', useValue: usageLogModel },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('listTenants', () => {
    it('should return tenants with counts', async () => {
      tenantModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          { _id: tenantId, code: 'acme', name: 'Acme', status: 'active' },
        ]),
      });
      tenantModel.countDocuments.mockReturnValue(execResolved(1));
      mockCounts({ team: 2, member: 5, key: 3 });

      const result = await service.listTenants({});

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: String(tenantId),
        code: 'acme',
        teamCount: 2,
        memberCount: 5,
        apiKeyCount: 3,
      });
    });
  });

  describe('createTenant', () => {
    it('should create a tenant and its default team', async () => {
      tenantModel.findOne.mockReturnValue(execResolved(null));
      tenantModel.create.mockResolvedValue({
        _id: tenantId,
        code: 'acme',
        name: 'Acme',
        status: 'active',
      });
      teamModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
      mockCounts({ team: 1, member: 0, key: 0 });

      const result = await service.createTenant('acme', 'Acme');

      expect(teamModel.create).toHaveBeenCalledWith({
        tenantId,
        name: '默认团队',
      });
      expect(result.code).toBe('acme');
    });

    it('should throw ConflictException when code exists', async () => {
      tenantModel.findOne.mockReturnValue(
        execResolved({ _id: tenantId }),
      );

      await expect(service.createTenant('acme', 'Acme')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateTenantStatus', () => {
    it('should suspend a tenant', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      tenantModel.findById.mockReturnValue(
        execResolved({
          _id: tenantId,
          code: 'acme',
          name: 'Acme',
          status: 'active',
          save,
        }),
      );
      mockCounts({ team: 1, member: 2, key: 1 });

      const result = await service.updateTenantStatus(
        String(tenantId),
        TenantStatus.SUSPENDED,
      );

      expect(save).toHaveBeenCalled();
      expect(result.status).toBe(TenantStatus.SUSPENDED);
    });

    it('should throw NotFoundException when tenant missing', async () => {
      tenantModel.findById.mockReturnValue(execResolved(null));

      await expect(
        service.updateTenantStatus(String(tenantId), TenantStatus.SUSPENDED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('overview', () => {
    it('should aggregate global counts and usage', async () => {
      tenantModel.countDocuments.mockReturnValue(execResolved(3));
      teamModel.countDocuments.mockReturnValue(execResolved(5));
      userModel.countDocuments.mockReturnValue(execResolved(20));
      apiKeyModel.countDocuments.mockReturnValue(execResolved(8));
      usageLogModel.aggregate.mockReturnValue(
        execResolved([{ requestCount: 100, totalTokens: 5000, totalCost: 1.25 }]),
      );

      const result = await service.overview({});

      expect(result.tenantCount).toBe(3);
      expect(result.teamCount).toBe(5);
      expect(result.memberCount).toBe(20);
      expect(result.apiKeyCount).toBe(8);
      expect(result.totalTokens).toBe(5000);
      expect(result.totalCost).toBe(1.25);
      expect(userModel.countDocuments).toHaveBeenCalledWith({
        role: { $ne: Role.SYSTEM },
      });
    });
  });

  describe('usageBreakdown', () => {
    it('should group usage by tenant with names', async () => {
      const otherTenantId = new Types.ObjectId();
      usageLogModel.aggregate.mockReturnValue(
        execResolved([
          { _id: tenantId, requestCount: 50, totalTokens: 3000, totalCost: 1 },
          {
            _id: otherTenantId,
            requestCount: 20,
            totalTokens: 1000,
            totalCost: 0.3,
          },
        ]),
      );
      tenantModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          { _id: tenantId, name: 'Acme' },
          { _id: otherTenantId, name: 'Beta' },
        ]),
      });

      const result = await service.usageBreakdown({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ name: 'Acme', totalTokens: 3000 });
      expect(result.items[1]).toMatchObject({ name: 'Beta', totalTokens: 1000 });
    });
  });
});
