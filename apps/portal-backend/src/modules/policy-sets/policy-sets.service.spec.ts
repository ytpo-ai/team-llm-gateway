import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PolicySetsService } from './policy-sets.service.js';
import {
  PolicyAction,
  PolicyMeasure,
  PolicyWindow,
} from './schemas/policy-set.schema.js';

describe('PolicySetsService', () => {
  let service: PolicySetsService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const setId = new Types.ObjectId();

  const policySetModel = {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };

  const makeSet = (overrides: Record<string, unknown> = {}) => ({
    _id: setId,
    tenantId: new Types.ObjectId(tenantId),
    teamId: new Types.ObjectId(teamId),
    name: '研发默认',
    description: '',
    entries: [],
    providerIds: [],
    modelWhitelist: [],
    builtIn: false,
    createdAt: new Date(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicySetsService,
        { provide: 'PolicySetModel', useValue: policySetModel },
      ],
    }).compile();

    service = module.get(PolicySetsService);
  });

  describe('create', () => {
    it('should create a team-level policy set', async () => {
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      policySetModel.create.mockImplementation(async (input: any) => ({
        ...makeSet(),
        ...input,
      }));

      const result = await service.create(tenantId, teamId, {
        name: 'VIP 客户',
        entries: [
          {
            measure: PolicyMeasure.TOKEN,
            window: PolicyWindow.MONTH,
            limit: 30000000,
            action: PolicyAction.BLOCK,
          },
        ],
        providerIds: [],
        modelWhitelist: [],
      });

      expect(result.name).toBe('VIP 客户');
      expect(result.entries).toHaveLength(1);
      expect(result.builtIn).toBe(false);
    });

    it('should reject duplicate measure+window entries', async () => {
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      const entry = {
        measure: PolicyMeasure.TOKEN,
        window: PolicyWindow.DAY,
        limit: 100,
        action: PolicyAction.BLOCK,
      };

      await expect(
        service.create(tenantId, teamId, {
          name: '重复条目',
          entries: [entry, entry],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate name', async () => {
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeSet()),
      });

      await expect(
        service.create(tenantId, teamId, { name: '研发默认' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('should filter built-in and team-scoped sets', async () => {
      policySetModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeSet()]),
      });

      await service.list(tenantId, teamId);

      const filter = policySetModel.find.mock.calls[0][0];
      expect(filter.$or).toEqual([
        { builtIn: true },
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
        },
      ]);
    });
  });

  describe('remove', () => {
    it('should reject removing built-in set', async () => {
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeSet({ builtIn: true })),
      });

      await expect(
        service.remove(tenantId, teamId, String(setId)),
      ).rejects.toThrow(ConflictException);
    });

    it('should remove a team set', async () => {
      const set = makeSet();
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(set),
      });

      const result = await service.remove(tenantId, teamId, String(setId));

      expect(set.deleteOne).toHaveBeenCalled();
      expect(result.name).toBe('研发默认');
    });
  });

  describe('get', () => {
    it('should throw NotFound when set not accessible', async () => {
      policySetModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.get(tenantId, teamId, String(setId)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
