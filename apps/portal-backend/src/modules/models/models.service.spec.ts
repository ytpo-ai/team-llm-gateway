import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ModelsService } from './models.service.js';
import { ModelStatus } from './schemas/model.schema.js';

describe('ModelsService', () => {
  let service: ModelsService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const providerId = new Types.ObjectId();
  const modelId = new Types.ObjectId();

  const modelModel = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  };

  const providerModel = {
    findOne: vi.fn(),
  };

  const makeModel = (overrides: Record<string, unknown> = {}) => ({
    _id: modelId,
    tenantId,
    teamId,
    providerId,
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    multiplier: 1.5,
    capabilities: ['chat'],
    aliases: [],
    status: ModelStatus.ACTIVE,
    createdAt: new Date(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        { provide: 'ModelModel', useValue: modelModel },
        { provide: 'ProviderModel', useValue: providerModel },
      ],
    }).compile();

    service = module.get(ModelsService);
  });

  describe('create', () => {
    it('should create when provider belongs to team', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: providerId }),
      });
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      modelModel.create.mockImplementation(async (input: any) => ({
        ...makeModel(),
        ...input,
      }));

      const result = await service.create(tenantId, teamId, {
        providerId: String(providerId),
        modelId: 'gpt-4o-mini',
        multiplier: 1.5,
      });

      expect(result.modelId).toBe('gpt-4o-mini');
      expect(result.multiplier).toBe(1.5);
      expect(modelModel.create.mock.calls[0][0].tenantId).toBe(tenantId);
    });

    it('should throw NotFound when provider missing', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.create(tenantId, teamId, {
          providerId: String(providerId),
          modelId: 'gpt-4o-mini',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate modelId', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: providerId }),
      });
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });

      await expect(
        service.create(tenantId, teamId, {
          providerId: String(providerId),
          modelId: 'gpt-4o-mini',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('should filter by tenant and team', async () => {
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeModel()]),
      });

      await service.list(tenantId, teamId);

      expect(modelModel.find.mock.calls[0][0]).toEqual({ tenantId, teamId });
    });
  });

  describe('remove', () => {
    it('should soft-disable', async () => {
      const model = makeModel();
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(model),
      });

      const result = await service.remove(tenantId, teamId, String(modelId));

      expect(model.status).toBe(ModelStatus.DISABLED);
      expect(result.status).toBe(ModelStatus.DISABLED);
    });
  });
});
