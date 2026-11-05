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
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  };

  const providerModel = {
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
  };

  const configService = {
    get: vi.fn(),
  };

  const makeProviderDoc = () => ({
    _id: providerId,
    name: 'Test Provider',
    status: 'active',
  });

  const makeModel = (overrides: Record<string, unknown> = {}) => ({
    _id: modelId,
    tenantId,
    teamId,
    providerId,
    providerBindings: [],
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

    // Default mocks for provider resolution (used by toView)
    providerModel.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(makeProviderDoc()),
    });
    providerModel.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([makeProviderDoc()]),
    });

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

    it('should create with providerBindings', async () => {
      const secondProviderId = new Types.ObjectId();
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
        modelId: 'deepseek-v4-pro',
        providerBindings: [
          { providerId: String(secondProviderId), priority: 1 },
        ],
      });

      expect(result.modelId).toBe('deepseek-v4-pro');
      expect(result.providerBindings).toBeDefined();
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

    it('should include providerBindings in view', async () => {
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeModel()]),
      });

      const result = await service.list(tenantId, teamId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('providerBindings');
    });
  });

  describe('update', () => {
    it('should update providerBindings', async () => {
      const secondProviderId = new Types.ObjectId();
      const model = makeModel();
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(model),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: secondProviderId }),
      });

      const result = await service.update(tenantId, teamId, String(modelId), {
        providerBindings: [
          { providerId: String(secondProviderId), priority: 1 },
        ],
      });

      expect(model.providerBindings).toHaveLength(1);
      expect(result.providerBindings).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should hard-delete', async () => {
      const model = makeModel();
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(model),
      });
      modelModel.deleteOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      const result = await service.remove(tenantId, teamId, String(modelId));

      expect(result.status).toBe(ModelStatus.ACTIVE);
      expect(modelModel.deleteOne).toHaveBeenCalledWith({ _id: model._id });
    });
  });

  describe('disable / enable', () => {
    it('should soft-disable', async () => {
      const model = makeModel();
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(model),
      });

      const result = await service.disable(tenantId, teamId, String(modelId));

      expect(model.status).toBe(ModelStatus.DISABLED);
      expect(result.status).toBe(ModelStatus.DISABLED);
    });

    it('should enable', async () => {
      const model = makeModel({ status: ModelStatus.DISABLED });
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(model),
      });

      const result = await service.enable(tenantId, teamId, String(modelId));

      expect(model.status).toBe(ModelStatus.ACTIVE);
      expect(result.status).toBe(ModelStatus.ACTIVE);
    });
  });

  describe('disableByProvider', () => {
    it('should return 0 without cascading (multi-channel)', async () => {
      const count = await service.disableByProvider(
        tenantId,
        teamId,
        String(providerId),
      );

      expect(count).toBe(0);
    });
  });

  describe('enableByProvider', () => {
    it('should return 0 without cascading (multi-channel)', async () => {
      const count = await service.enableByProvider(
        tenantId,
        teamId,
        String(providerId),
      );

      expect(count).toBe(0);
    });
  });

  describe('deleteByProvider', () => {
    it('should delegate to removeProviderBinding', async () => {
      // Models with this provider as primary or in bindings
      const model = makeModel();
      modelModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([model]),
      });

      const count = await service.deleteByProvider(
        tenantId,
        teamId,
        String(providerId),
      );

      // One model had no remaining bindings, so it was disabled
      expect(count).toBe(1);
    });
  });

  describe('removeProviderBinding', () => {
    it('should disable model with no remaining bindings', async () => {
      const model = makeModel();
      modelModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([model]),
      });

      const count = await service.removeProviderBinding(
        tenantId,
        teamId,
        String(providerId),
      );

      expect(count).toBe(1);
      expect(model.status).toBe(ModelStatus.DISABLED);
    });

    it('should switch to next binding when primary provider is removed', async () => {
      const altProviderId = new Types.ObjectId();
      const model = makeModel({
        providerBindings: [{ providerId: altProviderId, priority: 0 }],
      });
      modelModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([model]),
      });

      const count = await service.removeProviderBinding(
        tenantId,
        teamId,
        String(providerId),
      );

      expect(count).toBe(0);
      expect(String(model.providerId)).toBe(String(altProviderId));
      expect(model.providerBindings).toHaveLength(0);
      expect(model.status).toBe(ModelStatus.ACTIVE);
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