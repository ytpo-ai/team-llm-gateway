import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    updateMany: vi.fn(),
  };

  const providerModel = {
    findOne: vi.fn(),
  };

  const configService = {
    get: vi.fn(),
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
        { provide: ConfigService, useValue: configService },
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

  describe('disableByProvider', () => {
    it('should disable active models of the provider and return count', async () => {
      modelModel.updateMany.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ modifiedCount: 2 }),
      });

      const count = await service.disableByProvider(
        tenantId,
        teamId,
        String(providerId),
      );

      expect(count).toBe(2);
      const filter = modelModel.updateMany.mock.calls[0][0];
      expect(String(filter.providerId)).toBe(String(providerId));
      expect(filter.status).toBe(ModelStatus.ACTIVE);
      const update = modelModel.updateMany.mock.calls[0][1];
      expect(update).toEqual({ $set: { status: ModelStatus.DISABLED } });
    });
  });

  describe('bulkCreate', () => {
    it('should create new models and skip existing', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: providerId }),
      });
      modelModel.findOne.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(makeModel()),
      });
      modelModel.create.mockImplementation(async (input: any) => ({
        ...makeModel(),
        ...input,
      }));

      const result = await service.bulkCreate(tenantId, teamId, {
        providerId: String(providerId),
        models: [
          { modelId: 'gpt-4o', displayName: 'GPT-4o', multiplier: 1 },
          { modelId: 'gpt-4o-mini', multiplier: 0.3 },
        ],
      });

      expect(result.created).toHaveLength(1);
      expect(result.created[0].modelId).toBe('gpt-4o');
      expect(result.skipped).toEqual(['gpt-4o-mini']);
    });

    it('should throw NotFound when provider missing', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.bulkCreate(tenantId, teamId, {
          providerId: String(providerId),
          models: [{ modelId: 'gpt-4o' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOfficialPresets', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns static catalog when no remote url configured', async () => {
      configService.get.mockReturnValue('');

      const presets = await service.getOfficialPresets();

      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('formats');
      expect(presets[0]).toHaveProperty('models');
    });

    it('falls back to static catalog on remote fetch failure', async () => {
      configService.get.mockReturnValue('https://example.com/presets.json');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

      const presets = await service.getOfficialPresets();

      expect(presets.length).toBeGreaterThan(0);
    });

    it('returns remote catalog when fetch succeeds', async () => {
      configService.get.mockReturnValue('https://example.com/presets.json');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify([
              {
                key: 'openai',
                label: 'OpenAI',
                formats: [
                  { type: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
                ],
                models: [],
              },
            ]),
            { status: 200 },
          ),
        ),
      );

      const presets = await service.getOfficialPresets();

      expect(presets).toHaveLength(1);
      expect(presets[0].label).toBe('OpenAI');
    });
  });
});
