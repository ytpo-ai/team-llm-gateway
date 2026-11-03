import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import { QuotaLimitService } from './quota-limit.service.js';

describe('QuotaLimitService', () => {
  let service: QuotaLimitService;

  const teamId = String(new Types.ObjectId());
  const userId = String(new Types.ObjectId());
  const providerId = new Types.ObjectId();
  const templateId = new Types.ObjectId();

  const teamModel = { findById: vi.fn() };
  const userModel = { findById: vi.fn() };
  const roleTemplateModel = { findById: vi.fn() };

  const makeApiKey = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    tenantId: new Types.ObjectId(),
    teamId: new Types.ObjectId(teamId),
    userId: new Types.ObjectId(userId),
    name: null,
    keyHash: 'hash',
    keyPrefix: 'pk_test',
    status: ApiKeyStatus.ACTIVE,
    expiresAt: null,
    allowedModels: [],
    rateLimitPerMinute: null,
    maxTokens: null,
    limitDaily: null,
    limitWeekly: null,
    limitMonthly: null,
    providerIds: [],
    lastUsedAt: null,
    ...overrides,
  });

  const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
    _id: templateId,
    tenantId: null,
    teamId: null,
    name: '设计师',
    description: '',
    limitDaily: null,
    limitWeekly: null,
    limitMonthly: null,
    rateLimitPerMinute: null,
    providerIds: [],
    modelWhitelist: [],
    builtIn: true,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaLimitService,
        { provide: 'TeamModel', useValue: teamModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'RoleTemplateModel', useValue: roleTemplateModel },
      ],
    }).compile();

    service = module.get(QuotaLimitService);
  });

  describe('resolve', () => {
    it('should return null limits when no team/template/key limits', async () => {
      teamModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          limitDaily: null,
          limitWeekly: null,
          limitMonthly: null,
          providerIds: [],
        }),
      });
      userModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ roleTemplateId: null }),
      });

      const result = await service.resolve({
        teamId,
        userId,
        apiKey: makeApiKey(),
      });

      expect(result.memberRateLimitPerMinute).toBeNull();
      expect(result.keyRateLimitPerMinute).toBeNull();
      expect(result.team).not.toBeNull();
      expect(result.memberTemplate).toBeNull();
    });

    it('should split member and key rate limits', async () => {
      teamModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });
      userModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ roleTemplateId: templateId }),
      });
      roleTemplateModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTemplate({ rateLimitPerMinute: 30 })),
      });

      const result = await service.resolve({
        teamId,
        userId,
        apiKey: makeApiKey({ rateLimitPerMinute: 60 }),
      });

      expect(result.memberRateLimitPerMinute).toBe(30);
      expect(result.keyRateLimitPerMinute).toBe(60);
    });
  });

  describe('resolveMemberTemplate', () => {
    it('should return null when user has no roleTemplateId', async () => {
      userModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ roleTemplateId: null }),
      });

      const result = await service.resolveMemberTemplate(userId);

      expect(result).toBeNull();
      expect(roleTemplateModel.findById).not.toHaveBeenCalled();
    });

    it('should load template when user binds one', async () => {
      userModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ roleTemplateId: templateId }),
      });
      roleTemplateModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTemplate()),
      });

      const result = await service.resolveMemberTemplate(userId);

      expect(result?.name).toBe('设计师');
    });
  });

  describe('isProviderAllowed', () => {
    it('should allow when no whitelist configured', () => {
      const allowed = service.isProviderAllowed(
        null,
        null,
        makeApiKey(),
        String(providerId),
      );
      expect(allowed).toBe(true);
    });

    it('should reject when key whitelist excludes provider', () => {
      const allowed = service.isProviderAllowed(
        null,
        null,
        makeApiKey({ providerIds: [new Types.ObjectId()] }),
        String(providerId),
      );
      expect(allowed).toBe(false);
    });

    it('should allow when provider is in key whitelist', () => {
      const allowed = service.isProviderAllowed(
        null,
        null,
        makeApiKey({ providerIds: [providerId] }),
        String(providerId),
      );
      expect(allowed).toBe(true);
    });
  });

  describe('isModelAllowed', () => {
    it('should reject when member template whitelist excludes model', () => {
      const allowed = service.isModelAllowed(
        makeTemplate({ modelWhitelist: ['gpt-4o'] }) as never,
        makeApiKey(),
        'gpt-4o-mini',
      );
      expect(allowed).toBe(false);
    });

    it('should allow when both whitelists permit the model', () => {
      const allowed = service.isModelAllowed(
        makeTemplate({ modelWhitelist: ['gpt-4o-mini'] }) as never,
        makeApiKey({ allowedModels: ['gpt-4o-mini'] }),
        'gpt-4o-mini',
      );
      expect(allowed).toBe(true);
    });
  });
});
