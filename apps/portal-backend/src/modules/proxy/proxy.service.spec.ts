import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
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
  const providerModel = { findOne: vi.fn() };
  const apiKeyModel = { updateOne: vi.fn() };
  const usageService = { record: vi.fn(), sumTokensByApiKey: vi.fn(), sumTokens: vi.fn() };
  const billingService = { getSpendableBalance: vi.fn(), deduct: vi.fn() };
  const quotaLimitService = {
    resolve: vi.fn(),
    isModelAllowed: vi.fn(() => true),
    isProviderAllowed: vi.fn(() => true),
  };
  const rateLimitService = { assertAllowed: vi.fn() };
  const configService = { getOrThrow: vi.fn(() => 'test-secret') };

  const makeContext = (
    allowedModels: string[] = [],
    apiKeyOverrides: Record<string, unknown> = {},
  ): ApiKeyContext => ({
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
      allowedModels,
      rateLimitPerMinute: null,
      maxTokens: null,
      limitDaily: null,
      limitWeekly: null,
      limitMonthly: null,
      providerIds: [],
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
      ],
    }).compile();

    usageService.sumTokensByApiKey.mockResolvedValue(0);
    usageService.sumTokens.mockResolvedValue(0);
    billingService.getSpendableBalance.mockResolvedValue(100);
    billingService.deduct.mockResolvedValue(undefined);
    quotaLimitService.resolve.mockResolvedValue({
      rateLimitPerMinute: null,
      team: null,
      memberTemplate: null,
    });
    quotaLimitService.isModelAllowed.mockReturnValue(true);
    quotaLimitService.isProviderAllowed.mockReturnValue(true);
    rateLimitService.assertAllowed.mockReset();

    service = module.get(ProxyService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should filter by key allowedModels', async () => {
      modelModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          makeModel(),
          { ...makeModel(), modelId: 'gpt-4o' },
        ]),
      });

      const result = await service.listModels(makeContext(['gpt-4o-mini']));

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('gpt-4o-mini');
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

    it('should reject model not in allowedModels', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      quotaLimitService.isModelAllowed.mockReturnValue(false);

      await expect(
        service.chatCompletions(
          makeContext(['gpt-4o']),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject anthropic provider', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModel()),
      });
      providerModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...makeProvider(),
          type: ProviderType.ANTHROPIC,
        }),
      });

      await expect(
        service.chatCompletions(
          makeContext(),
          { model: 'gpt-4o-mini' },
          makeRes() as never,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('limits', () => {
    it('should reject when maxTokens budget is exhausted', async () => {
      usageService.sumTokensByApiKey.mockResolvedValue(1000);

      await expect(
        service.chatCompletions(
          makeContext([], { maxTokens: 1000 }),
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
      rateLimitService.assertAllowed.mockImplementation(() => {
        throw new HttpException('rate limited', 429);
      });

      await expect(
        service.chatCompletions(
          makeContext([], { rateLimitPerMinute: 1 }),
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
