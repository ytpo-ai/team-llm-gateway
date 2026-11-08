import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BillingService } from '../billing/billing.service.js';
import { QuotaLimitService } from '../billing/quota-limit.service.js';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import { ModelStatus } from '../models/schemas/model.schema.js';
import { UsageStatus } from '../usage/schemas/usage-log.schema.js';
import { UsageService } from '../usage/usage.service.js';
import { ProviderUsageService } from '../usage/provider-usage.service.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';
import { ProxyService } from './proxy.service.js';
import { PolicyResolver } from './policy-resolver.service.js';
import { MeterBackend, METER_BACKEND_TOKEN } from './meter-backend.interface.js';
import { Action, Measure, Window } from './protocol/types.js';

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
  const providerUsageService = {
    getAvailability: vi.fn((): { available: boolean; reason: string | null } => ({
      available: true,
      reason: null,
    })),
    markExhausted: vi.fn(),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
    updateFromHeaders: vi.fn(),
  };
  const configService = { getOrThrow: vi.fn(() => 'test-secret') };

  const makePolicyResolver = () => ({
    resolve: vi.fn(),
  });

  const makeMeterBackend = (): MeterBackend & {
    checkLimit: ReturnType<typeof vi.fn>;
    increment: ReturnType<typeof vi.fn>;
    acquireConcurrency: ReturnType<typeof vi.fn>;
    tryAcquireConcurrency: ReturnType<typeof vi.fn>;
  } => ({
    checkLimit: vi.fn().mockResolvedValue(true),
    increment: vi.fn().mockResolvedValue(undefined),
    acquireConcurrency: vi.fn(() => () => Promise.resolve()),
    tryAcquireConcurrency: vi.fn().mockResolvedValue(() => Promise.resolve()),
  });

  let policyResolver: ReturnType<typeof makePolicyResolver>;
  let meterBackend: ReturnType<typeof makeMeterBackend>;

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

  const makeCandidate = (overrides: Partial<{
    providerId: string;
    priority: number;
    type: 'openai-compatible' | 'anthropic' | 'gemini';
    baseUrl: string;
    apiKey: string;
    authType: string;
    multiplier: number;
  }> = {}) => ({
    providerId: String(providerId),
    priority: 0,
    type: 'openai-compatible' as const,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-upstream',
    authType: 'api-key',
    multiplier: 1.5,
    ...overrides,
  });

  const makePolicy = () => ({
    version: 1 as const,
    subject: { tenantId, teamId, userId, apiKeyId: String(apiKeyId) },
    states: [
      { name: 'balance_ok', ok: true, action: Action.BLOCK },
      { name: 'key_active', ok: true, action: Action.BLOCK },
      { name: 'model_active', ok: true, action: Action.BLOCK },
    ],
    allowlists: { model: null, provider: null },
    limits: [],
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

    policyResolver = makePolicyResolver();
    meterBackend = makeMeterBackend();

    // Default resolve: happy path
    policyResolver.resolve.mockResolvedValue({
      policy: makePolicy(),
      candidates: [makeCandidate()],
    });

    // listModels mocks
    providerModel.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([{ _id: providerId }]),
    });
    modelModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });
    quotaLimitService.resolve.mockResolvedValue({
      team: null,
      role: null,
      key: null,
    });
    billingService.getSpendableBalance.mockResolvedValue(100);
    billingService.deduct.mockResolvedValue(undefined);
    usageService.record.mockResolvedValue(undefined);
    apiKeyModel.updateOne.mockResolvedValue(undefined);

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
        { provide: ProviderUsageService, useValue: providerUsageService },
        { provide: PolicyResolver, useValue: policyResolver },
        { provide: METER_BACKEND_TOKEN, useValue: meterBackend },
      ],
    }).compile();

    service = module.get(ProxyService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should filter by key policy set modelWhitelist', async () => {
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          { ...makePolicy(), modelId: 'gpt-4o-mini', createdAt: new Date() },
          { ...makePolicy(), modelId: 'gpt-4o', createdAt: new Date() },
        ] as unknown[]),
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
      await service.listModels(makeContext());

      const modelFilter = modelModel.find.mock.calls[0][0];
      expect(modelFilter.status).toBe(ModelStatus.ACTIVE);
      expect(modelFilter.providerId).toEqual({ $in: [providerId] });
    });
  });

  describe('chatCompletions', () => {
    it('should forward, record usage and return upstream json', async () => {
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

    it('should reject when model not in whitelist (via PolicyResolver)', async () => {
      policyResolver.resolve.mockRejectedValue(
        new HttpException('该 API Key 或成员角色不允许访问此模型', 403),
      );

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should fall back and return 502 when the only channel has a network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      );

      const res = makeRes();
      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        res as never,
      );

      expect(providerUsageService.recordFailure).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
        expect.stringContaining('ECONNREFUSED'),
      );
      expect(res.status).toHaveBeenCalledWith(502);
    });

    it('should mark exhausted with response headers on 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('{"error":"rate limited"}', {
            status: 429,
            headers: { 'retry-after': '30' },
          }),
        ),
      );

      const res = makeRes();
      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        res as never,
      );

      expect(providerUsageService.markExhausted).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
        expect.any(String),
        expect.objectContaining({ 'retry-after': '30' }),
      );
    });

    it('should record failure on 5xx and success on 2xx', async () => {
      // 5xx path
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('oops', { status: 500 })),
      );
      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        makeRes() as never,
      );
      expect(providerUsageService.recordFailure).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
        expect.stringContaining('500'),
      );

      // success path
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
      expect(providerUsageService.recordSuccess).toHaveBeenCalledWith(
        tenantId,
        teamId,
        String(providerId),
      );
    });

    it('should skip candidates that are unavailable (cooldown)', async () => {
      // Return 0 candidates → all channels exhausted
      policyResolver.resolve.mockResolvedValue({
        policy: makePolicy(),
        candidates: [],
      });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = makeRes();
      await service.chatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini' },
        res as never,
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(502);
    });
  });

  describe('limits', () => {
    it('should reject when policy states block', async () => {
      policyResolver.resolve.mockResolvedValue({
        policy: {
          ...makePolicy(),
          states: [
            { name: 'balance_ok', ok: false, action: Action.BLOCK, code: 'BALANCE_INSUFFICIENT', message: '额度余额不足' },
          ],
        },
        candidates: [makeCandidate()],
      });

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should reject when MeterBackend limit check returns false', async () => {
      policyResolver.resolve.mockResolvedValue({
        policy: {
          ...makePolicy(),
          limits: [
            { scope: 'team' as const, measure: Measure.TOKEN, window: Window.DAY, limit: 1000, action: Action.BLOCK },
          ],
        },
        candidates: [makeCandidate()],
      });
      meterBackend.checkLimit.mockResolvedValue(false);

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should reject when concurrency limit exceeded', async () => {
      policyResolver.resolve.mockResolvedValue({
        policy: {
          ...makePolicy(),
          limits: [
            { scope: 'key' as const, measure: Measure.CONCURRENCY, window: Window.PERMANENT, limit: 1, action: Action.BLOCK },
          ],
        },
        candidates: [makeCandidate()],
      });
      meterBackend.tryAcquireConcurrency.mockRejectedValue(new Error('并发数已达上限'));

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should release concurrency on success', async () => {
      const release = vi.fn();
      policyResolver.resolve.mockResolvedValue({
        policy: {
          ...makePolicy(),
          limits: [
            { scope: 'key' as const, measure: Measure.CONCURRENCY, window: Window.PERMANENT, limit: 5, action: Action.BLOCK },
          ],
        },
        candidates: [makeCandidate()],
      });
      meterBackend.tryAcquireConcurrency.mockResolvedValue(release);

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

      expect(release).toHaveBeenCalled();
    });
  });

  describe('streamChatCompletions', () => {
    it('should pipe SSE and extract usage', async () => {
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

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
      );

      const res = makeRes();
      await service.streamChatCompletions(
        makeContext(),
        { model: 'gpt-4o-mini', stream: true },
        res as never,
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        'content-type',
        'text/event-stream',
      );
      expect(res.end).toHaveBeenCalled();
      const recorded = usageService.record.mock.calls[0][0];
      expect(recorded.totalTokens).toBe(5);
      expect(recorded.promptTokens).toBe(3);
    });
  });
});