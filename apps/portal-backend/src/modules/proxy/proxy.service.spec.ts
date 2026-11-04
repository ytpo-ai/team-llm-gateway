import { ForbiddenException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { encrypt } from '../../common/crypto/cipher.js';
import { BillingService } from '../billing/billing.service.js';
import { QuotaLimitService } from '../billing/quota-limit.service.js';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import { ModelStatus } from '../models/schemas/model.schema.js';
import {
  ProviderStatus,
  ProviderType,
} from '../providers/schemas/provider.schema.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { ConcurrencyService } from './concurrency.service.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';
import { ProxyService } from './proxy.service.js';
import { RateLimitService } from './rate-limit.service.js';

describe('ProxyService', () => {
  let service: ProxyService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const userId = String(new Types.ObjectId());
  const apiKeyId = new Types.ObjectId();
  const providerId = new Types.ObjectId();

  const modelModel = { find: vi.fn(), findOne: vi.fn() };
  const providerModel = { find: vi.fn(), findOne: vi.fn() };
  const apiKeyModel = { updateOne: vi.fn() };
  const usageService = { record: vi.fn() };
  const billingService = { getSpendableBalance: vi.fn(), deduct: vi.fn() };
  const quotaLimitService = {
    resolve: vi.fn(),
    resolveRateLimits: vi.fn(),
    assertUsageLimits: vi.fn(),
    isModelAllowed: vi.fn(() => true),
    isProviderAllowed: vi.fn(() => true),
  };
  const rateLimitService = { assertAllowed: vi.fn() };
  const concurrencyService = { acquire: vi.fn(() => () => undefined) };
  const configService = { getOrThrow: vi.fn(() => 'test-secret') };

  const makeContext = (apiKeyOverrides: Record<string, unknown> = {}): ApiKeyContext => ({
    tenantId,
    teamId,
    userId,
    apiKeyId: String(apiKeyId),
    apiKey: {
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
      name: 'key',
      keyHash: 'hash',
      keyPrefix: 'pk_test',
      status: ApiKeyStatus.ACTIVE,
      expiresAt: null,
      policySetId: null,
      lastUsedAt: null,
      _id: apiKeyId,
      ...apiKeyOverrides,
    } as ApiKeyContext['apiKey'],
  });

  const makeModel = () => ({
    _id: new Types.ObjectId(),
    tenantId,
    teamId,
    providerId,
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    multiplier: 1.5,
    capabilities: [],
    aliases: [],
    status: ModelStatus.ACTIVE,
    createdAt: new Date(),
  });

  const makeProvider = () => ({
    _id: providerId,
    tenantId,
    teamId,
    name: 'OpenAI',
    type: ProviderType.OPENAI_COMPATIBLE,
    baseUrl: 'https://api.openai.com/v1/',
    apiKeyCiphertext: encrypt('test-secret', 'sk-upstream'),
    apiKeyHint: 'sk-***',
    status: ProviderStatus.ACTIVE,
  });

  const makeRes = () => ({
    status: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    json: vi.fn(),
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: 'ModelModel', useValue: modelModel },
        { provide: 'ProviderModel', useValue: providerModel },
        { provide: 'ApiKeyModel', useValue: apiKeyModel },
        { provide: ConfigService, useValue: configService },
        { provide: UsageService, useValue: usageService },
        { provide: BillingService, useValue: billingService },
        { provide: QuotaLimitService, useValue: quotaLimitService },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: ConcurrencyService, useValue: concurrencyService },
      ],
    }).compile();

    billingService.getSpendableBalance.mockResolvedValue(100);
    billingService.deduct.mockResolvedValue(undefined);
    quotaLimitService.resolve.mockResolvedValue({
      team: null,
      role: null,
      key: null,
    });
    quotaLimitService.resolveRateLimits.mockReturnValue({
      teamPerMinute: null,
      memberPerMinute: null,
      keyPerMinute: null,
      keyConcurrency: null,
    });
    quotaLimitService.assertUsageLimits.mockResolvedValue(undefined);
    quotaLimitService.isModelAllowed.mockReturnValue(true);
    quotaLimitService.isProviderAllowed.mockReturnValue(true);
    rateLimitService.assertAllowed.mockReset();
    concurrencyService.acquire.mockReturnValue(() => undefined);

    service = module.get(ProxyService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should filter by key policy set modelWhitelist', async () => {
      providerModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([{ _id: providerId }]),
      });
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          makeModel(),
          { ...makeModel(), modelId: 'gpt-4o' },
        ]),
      });
      quotaLimitService.resolve.mockResolvedValue({
        team: null,
        role: null,
        key: { modelWhitelist: ['gpt-4o-mini'] },
      });

      const result = await service.listModels(makeContext());

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('gpt-4o-mini');
    });

    it('should exclude models whose provider is disabled', async () => {
      providerModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([{ _id: providerId }]),
      });
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeModel()]),
      });
      quotaLimitService.resolve.mockResolvedValue({
        team: null,
        role: null,
        key: null,
      });

      await service.listModels(makeContext());

      const modelFilter = modelModel.find.mock.calls[0][0];
      expect(modelFilter.status).toBe(ModelStatus.ACTIVE);
      expect(modelFilter.providerId).toEqual({ $in: [providerId] });
    });
  });

  describe('chatCompletions', () => {
    it('should forward, record usage and return upstream json', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeProvider()),
      });
      usageService.record.mockResolvedValue(undefined);
      apiKeyModel.updateOne.mockResolvedValue(undefined);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'hi' } }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }),
            { status: 200 },
          ),
        ),
      );

      const res = makeRes();
      const result = await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect((result as { usage: { total_tokens: number } }).usage.total_tokens).toBe(15);
      const recorded = usageService.record.mock.calls[0][0];
      expect(recorded.totalTokens).toBe(15);
      expect(recorded.cost).toBe(22.5);
      expect(recorded.status).toBe(UsageStatus.SUCCESS);
      expect(apiKeyModel.updateOne).toHaveBeenCalled();
    });

    it('should reject model not in whitelist', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      quotaLimitService.isModelAllowed.mockReturnValue(false);

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('limits', () => {
    it('should reject when usage limits block', async () => {
      quotaLimitService.assertUsageLimits.mockRejectedValue(
        new HttpException('团队日 Token 限额已用尽', 429),
      );

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should reject when quota balance is zero', async () => {
      billingService.getSpendableBalance.mockResolvedValue(0);

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should reject when rate limit is exceeded', async () => {
      quotaLimitService.resolveRateLimits.mockReturnValue({
        teamPerMinute: null,
        memberPerMinute: 30,
        keyPerMinute: null,
        keyConcurrency: null,
      });
      rateLimitService.assertAllowed.mockImplementation(() => {
        throw new HttpException('rate limited', 429);
      });

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should enforce member rate limit by userId and key rate limit by apiKeyId', async () => {
      quotaLimitService.resolveRateLimits.mockReturnValue({
        teamPerMinute: null,
        memberPerMinute: 30,
        keyPerMinute: 60,
        keyConcurrency: null,
      });
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeProvider()),
      });
      usageService.record.mockResolvedValue(undefined);
      apiKeyModel.updateOne.mockResolvedValue(undefined);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'hi' } }],
              usage: { total_tokens: 0 },
            }),
            { status: 200 },
          ),
        ),
      );

      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        makeRes() as never,
      );

      expect(rateLimitService.assertAllowed).toHaveBeenCalledWith(userId, 30);
      expect(rateLimitService.assertAllowed).toHaveBeenCalledWith(
        String(apiKeyId),
        60,
      );
    });

    it('should acquire and release concurrency for the api key', async () => {
      const release = vi.fn();
      quotaLimitService.resolveRateLimits.mockReturnValue({
        teamPerMinute: null,
        memberPerMinute: null,
        keyPerMinute: null,
        keyConcurrency: 5,
      });
      concurrencyService.acquire.mockReturnValue(release);
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeProvider()),
      });
      usageService.record.mockResolvedValue(undefined);
      apiKeyModel.updateOne.mockResolvedValue(undefined);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'hi' } }],
              usage: { total_tokens: 0 },
            }),
            { status: 200 },
          ),
        ),
      );

      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        makeRes() as never,
      );

      expect(concurrencyService.acquire).toHaveBeenCalledWith(String(apiKeyId), 5);
      expect(release).toHaveBeenCalled();
    });

    it('should reject when concurrency limit exceeded', async () => {
      quotaLimitService.resolveRateLimits.mockReturnValue({
        teamPerMinute: null,
        memberPerMinute: null,
        keyPerMinute: null,
        keyConcurrency: 1,
      });
      concurrencyService.acquire.mockImplementation(() => {
        throw new HttpException('API Key 并发数已达上限', 429);
      });

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('streamChatCompletions', () => {
    it('should pipe SSE and extract usage', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeProvider()),
      });
      usageService.record.mockResolvedValue(undefined);
      apiKeyModel.updateOne.mockResolvedValue(undefined);

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

      const res = makeRes();
      await service.streamChatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini', stream: true },
        res as never,
      );

      expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/event-stream');
      expect(res.end).toHaveBeenCalled();
      const recorded = usageService.record.mock.calls[0][0];
      expect(recorded.totalTokens).toBe(5);
      expect(recorded.promptTokens).toBe(3);
    });
  });
});
