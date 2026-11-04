import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { decrypt, encrypt } from '../../common/crypto/cipher.js';
import { ModelsService } from '../models/models.service.js';
import { ProvidersService } from './providers.service.js';
import { ProviderStatus, ProviderType } from './schemas/provider.schema.js';

describe('ProvidersService', () => {
  let service: ProvidersService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const providerId = new Types.ObjectId();
  const secret = 'test-encryption-secret';

  const providerModel = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    deleteOne: vi.fn(),
  };

  const configService = {
    getOrThrow: vi.fn().mockReturnValue(secret),
  };

  const modelsService = {
    getOfficialPresets: vi.fn(),
    bulkCreate: vi.fn(),
    list: vi.fn(),
    disableByProvider: vi.fn(),
    enableByProvider: vi.fn(),
    deleteByProvider: vi.fn(),
  };

  const makeProvider = (overrides: Record<string, unknown> = {}) => ({
    _id: providerId,
    tenantId,
    teamId,
    name: 'OpenAI 直连',
    type: ProviderType.OPENAI_COMPATIBLE,
    baseUrl: 'https://api.openai.com/v1',
    apiKeyCiphertext: 'cipher',
    apiKeyHint: 'sk-***abcd',
    status: ProviderStatus.ACTIVE,
    createdAt: new Date(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    configService.getOrThrow.mockReturnValue(secret);
    modelsService.list.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: 'ProviderModel', useValue: providerModel },
        { provide: ConfigService, useValue: configService },
        { provide: ModelsService, useValue: modelsService },
      ],
    }).compile();

    service = module.get(ProvidersService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('create', () => {
    it('should encrypt apiKey and never store plaintext', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      providerModel.create.mockImplementation(async (input: any) => ({
        ...makeProvider(),
        ...input,
      }));

      const result = await service.create(tenantId, teamId, {
        name: 'OpenAI 直连',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-live-1234567890abcd',
      });

      const createArg = providerModel.create.mock.calls[0][0];
      expect(createArg.apiKeyCiphertext).not.toContain('sk-live');
      expect(decrypt(secret, createArg.apiKeyCiphertext)).toBe(
        'sk-live-1234567890abcd',
      );
      expect(createArg.apiKey).toBeUndefined();
      expect(result.apiKeyHint).toBe('sk-***abcd');
    });

    it('should reject duplicate name', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeProvider()),
      });

      await expect(
        service.create(tenantId, teamId, {
          name: 'OpenAI 直连',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-x',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createFromPreset', () => {
    const preset = {
      key: 'deepseek',
      label: 'DeepSeek',
      formats: [
        {
          type: ProviderType.OPENAI_COMPATIBLE,
          baseUrl: 'https://api.deepseek.com',
        },
        {
          type: ProviderType.ANTHROPIC,
          baseUrl: 'https://api.deepseek.com/anthropic',
        },
      ],
      models: [
        {
          modelId: 'deepseek-flash',
          displayName: 'DeepSeek Flash',
          capabilities: ['chat'],
          multiplier: 0.1,
        },
      ],
    };

    it('creates provider with preset fields and imports models', async () => {
      modelsService.getOfficialPresets.mockResolvedValue([preset]);
      modelsService.bulkCreate.mockResolvedValue({
        created: [],
        skipped: [],
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      providerModel.create.mockImplementation(async (input: any) => ({
        ...makeProvider(),
        ...input,
      }));

      const result = await service.createFromPreset(tenantId, teamId, {
        presetKey: 'deepseek',
        apiKey: 'sk-live-1234567890abcd',
      });

      expect(result.provider.name).toBe('DeepSeek');
      expect(result.provider.presetKey).toBe('deepseek');
      const createArg = providerModel.create.mock.calls[0][0];
      expect(createArg.baseUrl).toBe('https://api.deepseek.com');
      expect(createArg.type).toBe(ProviderType.OPENAI_COMPATIBLE);
      expect(modelsService.bulkCreate).toHaveBeenCalledWith(tenantId, teamId, {
        providerId: result.provider.id,
        models: [
          {
            modelId: 'deepseek-flash',
            displayName: 'DeepSeek Flash',
            multiplier: 0.1,
            capabilities: ['chat'],
            aliases: [],
          },
        ],
      });
    });

    it('selects the requested format type and baseUrl', async () => {
      modelsService.getOfficialPresets.mockResolvedValue([preset]);
      modelsService.bulkCreate.mockResolvedValue({ created: [], skipped: [] });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      providerModel.create.mockImplementation(async (input: any) => ({
        ...makeProvider(),
        ...input,
      }));

      await service.createFromPreset(tenantId, teamId, {
        presetKey: 'deepseek',
        apiKey: 'sk-x',
        format: ProviderType.ANTHROPIC,
      });

      const createArg = providerModel.create.mock.calls[0][0];
      expect(createArg.type).toBe(ProviderType.ANTHROPIC);
      expect(createArg.baseUrl).toBe('https://api.deepseek.com/anthropic');
    });

    it('overrides baseUrl while keeping the format type', async () => {
      modelsService.getOfficialPresets.mockResolvedValue([preset]);
      modelsService.bulkCreate.mockResolvedValue({ created: [], skipped: [] });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      providerModel.create.mockImplementation(async (input: any) => ({
        ...makeProvider(),
        ...input,
      }));

      await service.createFromPreset(tenantId, teamId, {
        presetKey: 'deepseek',
        apiKey: 'sk-x',
        format: ProviderType.OPENAI_COMPATIBLE,
        baseUrl: 'https://custom.example.com/v1',
      });

      const createArg = providerModel.create.mock.calls[0][0];
      expect(createArg.type).toBe(ProviderType.OPENAI_COMPATIBLE);
      expect(createArg.baseUrl).toBe('https://custom.example.com/v1');
    });

    it('throws NotFound when preset key missing', async () => {
      modelsService.getOfficialPresets.mockResolvedValue([preset]);

      await expect(
        service.createFromPreset(tenantId, teamId, {
          presetKey: 'unknown',
          apiKey: 'sk-x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses custom name when provided', async () => {
      modelsService.getOfficialPresets.mockResolvedValue([preset]);
      modelsService.bulkCreate.mockResolvedValue({
        created: [],
        skipped: [],
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      providerModel.create.mockImplementation(async (input: any) => ({
        ...makeProvider(),
        ...input,
      }));

      const result = await service.createFromPreset(tenantId, teamId, {
        presetKey: 'deepseek',
        apiKey: 'sk-live-1234567890abcd',
        name: 'DeepSeek 公司主账号',
      });

      expect(result.provider.name).toBe('DeepSeek 公司主账号');
    });
  });

  describe('list', () => {
    it('should filter by tenant and team', async () => {
      providerModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeProvider()]),
      });

      await service.list(tenantId, teamId);

      expect(providerModel.find.mock.calls[0][0]).toEqual({
        tenantId,
        teamId,
      });
    });
  });

  describe('update', () => {
    it('should re-encrypt apiKey when provided', async () => {
      const provider = makeProvider();
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(provider),
      });

      await service.update(tenantId, teamId, String(providerId), {
        apiKey: 'sk-new-key-9999',
      });

      expect(decrypt(secret, provider.apiKeyCiphertext)).toBe('sk-new-key-9999');
    });

    it('should throw NotFound when missing', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(tenantId, teamId, String(providerId), { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should hard-delete provider and cascade-delete its models', async () => {
      const provider = makeProvider();
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(provider),
      });
      providerModel.deleteOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      modelsService.deleteByProvider.mockResolvedValue(2);

      const result = await service.remove(tenantId, teamId, String(providerId));

      expect(result.status).toBe(ProviderStatus.ACTIVE);
      expect(modelsService.deleteByProvider).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
      );
      expect(providerModel.deleteOne).toHaveBeenCalledWith({ _id: provider._id });
    });
  });

  describe('disable', () => {
    it('should soft-disable provider and cascade-disable its models', async () => {
      const provider = makeProvider();
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(provider),
      });
      modelsService.disableByProvider.mockResolvedValue(2);

      const result = await service.disable(tenantId, teamId, String(providerId));

      expect(provider.status).toBe(ProviderStatus.DISABLED);
      expect(result.status).toBe(ProviderStatus.DISABLED);
      expect(modelsService.disableByProvider).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
      );
    });
  });

  describe('enable', () => {
    it('should enable provider and cascade-enable its models', async () => {
      const provider = makeProvider({ status: ProviderStatus.DISABLED });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(provider),
      });
      modelsService.enableByProvider.mockResolvedValue(2);

      const result = await service.enable(tenantId, teamId, String(providerId));

      expect(provider.status).toBe(ProviderStatus.ACTIVE);
      expect(result.status).toBe(ProviderStatus.ACTIVE);
      expect(modelsService.enableByProvider).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
      );
    });
  });

  describe('test', () => {
    const makeTestProvider = () =>
      makeProvider({
        apiKeyCiphertext: encrypt(secret, 'sk-upstream'),
      });

    it('should report connectivity success on 2xx', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTestProvider()),
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
      );

      const result = await service.test(tenantId, teamId, String(providerId));

      expect(result.ok).toBe(true);
      expect(result.message).toContain('连通正常');
    });

    it('should report auth failure on 401', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTestProvider()),
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
      );

      const result = await service.test(tenantId, teamId, String(providerId));

      expect(result.ok).toBe(false);
      expect(result.message).toContain('鉴权失败');
    });

    it('should report failure on network error', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTestProvider()),
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('connection refused')),
      );

      const result = await service.test(tenantId, teamId, String(providerId));

      expect(result.ok).toBe(false);
    });

    it('probes with the provider own model when available', async () => {
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTestProvider()),
      });
      modelsService.list.mockResolvedValue([
        { providerId: String(providerId), modelId: 'qwen-plus', status: 'active' },
      ]);
      let capturedBody = '';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, opts: { body: string }) => {
          capturedBody = opts.body;
          return Promise.resolve(new Response('{}', { status: 200 }));
        }),
      );

      const result = await service.test(tenantId, teamId, String(providerId));

      expect(result.ok).toBe(true);
      expect(capturedBody).toContain('qwen-plus');
    });
  });

  it('round-trips encryption', () => {
    const ciphertext = encrypt(secret, 'sk-plain-0000');
    expect(decrypt(secret, ciphertext)).toBe('sk-plain-0000');
  });
});
