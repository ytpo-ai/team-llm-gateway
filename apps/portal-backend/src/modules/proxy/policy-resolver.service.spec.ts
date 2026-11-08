import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { encrypt } from '../../common/crypto/cipher.js';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import { BillingService } from '../billing/billing.service.js';
import { ModelStatus } from '../models/schemas/model.schema.js';
import {
  PolicyAction,
  PolicyMeasure,
  PolicyWindow,
} from '../policy-sets/schemas/policy-set.schema.js';
import { ProviderStatus, ProviderType } from '../providers/schemas/provider.schema.js';
import { ProviderUsageService } from '../usage/provider-usage.service.js';
import { Action, Measure, Window } from './protocol/types.js';
import { PolicyResolver } from './policy-resolver.service.js';

describe('PolicyResolver', () => {
  let resolver: PolicyResolver;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const userId = String(new Types.ObjectId());
  const apiKeyId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const modelId = new Types.ObjectId();

  const teamModel = { findById: vi.fn() };
  const userModel = { findById: vi.fn() };
  const roleTemplateModel = { findById: vi.fn() };
  const policySetModel = { findById: vi.fn() };
  const modelModel = { findOne: vi.fn() };
  const providerModel = { find: vi.fn() };
  const billingService = { getSpendableBalance: vi.fn() };
  const providerUsageService = { getAvailability: vi.fn() };
  const configService = { getOrThrow: vi.fn(() => 'test-secret') };

  const makeApiKey = (overrides: Record<string, unknown> = {}) => ({
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
    ...overrides,
  });

  const makeModelDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: modelId,
    tenantId,
    teamId,
    providerId,
    providerBindings: [],
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    multiplier: 1.5,
    capabilities: [],
    aliases: [],
    status: ModelStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  });

  const makeProviderDoc = (id = providerId, type = ProviderType.OPENAI_COMPATIBLE) => ({
    _id: id,
    tenantId,
    teamId,
    name: 'OpenAI',
    type,
    baseUrl: 'https://api.openai.com/v1/',
    apiKeyCiphertext: encrypt('test-secret', 'sk-upstream'),
    apiKeyHint: 'sk-***',
    authType: 'api-key',
    status: ProviderStatus.ACTIVE,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyResolver,
        { provide: 'TeamModel', useValue: teamModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'RoleTemplateModel', useValue: roleTemplateModel },
        { provide: 'PolicySetModel', useValue: policySetModel },
        { provide: 'ModelModel', useValue: modelModel },
        { provide: 'ProviderModel', useValue: providerModel },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderUsageService, useValue: providerUsageService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    // Default happy-path mocks
    teamModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue({ _id: teamId }) });
    userModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue({ _id: userId }) });
    roleTemplateModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });
    policySetModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
    modelModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(makeModelDoc()) });
    providerModel.find.mockReturnValue({ exec: vi.fn().mockResolvedValue([makeProviderDoc()]) });
    billingService.getSpendableBalance.mockResolvedValue(100);
    providerUsageService.getAvailability.mockResolvedValue({ available: true, reason: null });
    configService.getOrThrow.mockReturnValue('test-secret');

    resolver = module.get(PolicyResolver);
  });

  describe('resolve', () => {
    it('should return StandardPolicy with all three layers', async () => {
      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.policy.version).toBe(1);
      expect(result.policy.subject.tenantId).toBe(tenantId);
      expect(result.policy.subject.teamId).toBe(teamId);
      expect(result.policy.subject.userId).toBe(userId);
      expect(result.policy.subject.apiKeyId).toBe(String(apiKeyId));

      // States should always be present
      const stateNames = result.policy.states.map((s) => s.name);
      expect(stateNames).toContain('balance_ok');
      expect(stateNames).toContain('key_active');
      expect(stateNames).toContain('model_active');

      // All states should be ok in happy path
      for (const s of result.policy.states) {
        expect(s.ok).toBe(true);
      }

      // Candidates should be non-empty
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should build balance_ok state as block when balance is zero', async () => {
      billingService.getSpendableBalance.mockResolvedValue(0);

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      const balState = result.policy.states.find((s) => s.name === 'balance_ok');
      expect(balState).toBeDefined();
      expect(balState!.ok).toBe(false);
      expect(balState!.action).toBe(Action.BLOCK);
      expect(balState!.code).toBe('BALANCE_INSUFFICIENT');
    });

    it('should build key_active state as block when key is revoked', async () => {
      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey({ status: ApiKeyStatus.REVOKED }),
        requestedModel: 'gpt-4o-mini',
      });

      const keyState = result.policy.states.find((s) => s.name === 'key_active');
      expect(keyState).toBeDefined();
      expect(keyState!.ok).toBe(false);
      expect(keyState!.action).toBe(Action.BLOCK);
      expect(keyState!.code).toBe('KEY_INACTIVE');
    });

    it('should build key_active as block when key is expired', async () => {
      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey({ expiresAt: new Date('2020-01-01') }),
        requestedModel: 'gpt-4o-mini',
      });

      const keyState = result.policy.states.find((s) => s.name === 'key_active');
      expect(keyState!.ok).toBe(false);
    });

    it('should throw NotFoundException when model does not exist', async () => {
      modelModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });

      await expect(
        resolver.resolve({
          tenantId,
          teamId,
          userId,
          apiKey: makeApiKey(),
          requestedModel: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when model not in whitelist', async () => {
      policySetModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          modelWhitelist: ['other-model'],
        }),
      });

      await expect(
        resolver.resolve({
          tenantId,
          teamId,
          userId,
          apiKey: makeApiKey({ policySetId: apiKeyId }),
          requestedModel: 'gpt-4o-mini',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should resolve model by alias', async () => {
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModelDoc({ aliases: ['my-gpt'] })),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'my-gpt',
      });

      expect(result.policy.states.every((s) => s.ok)).toBe(true);
    });

    it('should intersect model allowlists from three levels', async () => {
      // team allows [a, b, c], role allows [b, c, d], key allows [c, d, e] → intersection = [c]
      const sets = new Map<string, { _id: string; modelWhitelist: string[] }>();
      sets.set('team-set', { _id: 'team-set', modelWhitelist: ['a', 'b', 'c'] });
      sets.set('role-set', { _id: 'role-set', modelWhitelist: ['b', 'c', 'd'] });
      sets.set('key-set', { _id: 'key-set', modelWhitelist: ['c', 'd', 'e'] });

      policySetModel.findById.mockImplementation((id: string) => ({
        exec: vi.fn().mockResolvedValue(sets.get(String(id)) ?? null),
      }));

      teamModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: teamId, policySetId: 'team-set' }),
      });
      userModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: userId, roleTemplateId: 'role-tmpl' }),
      });
      roleTemplateModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'role-tmpl', policySetId: 'role-set' }),
      });

      // Model must pass whitelist: key allows [c,d,e], modelId must be one of those
      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeModelDoc({ modelId: 'c' })),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey({ policySetId: 'key-set' }),
        requestedModel: 'c',
      });

      expect(result.policy.allowlists.model).toEqual(['c']);
    });

    it('should set allowlists to null when no level has restrictions', async () => {
      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.policy.allowlists.model).toBeNull();
      expect(result.policy.allowlists.provider).toBeNull();
    });

    it('should flatten limits from three levels', async () => {
      const teamSet = {
        _id: 'team-set',
        entries: [
          { measure: PolicyMeasure.TOKEN, window: PolicyWindow.DAY, limit: 10000, action: PolicyAction.BLOCK },
          { measure: PolicyMeasure.REQUEST, window: PolicyWindow.MINUTE, limit: 60, action: PolicyAction.BLOCK },
        ],
        modelWhitelist: [],
        providerIds: [],
      };
      const keySet = {
        _id: 'key-set',
        entries: [
          { measure: PolicyMeasure.SPEND, window: PolicyWindow.MONTH, limit: 500, action: PolicyAction.BLOCK },
          { measure: PolicyMeasure.CONCURRENCY, window: PolicyWindow.PERMANENT, limit: 5, action: PolicyAction.BLOCK },
        ],
        modelWhitelist: [],
        providerIds: [],
      };

      policySetModel.findById.mockImplementation((id: string) => {
        const sid = String(id);
        if (sid === 'team-set') return { exec: vi.fn().mockResolvedValue(teamSet) };
        if (sid === 'key-set') return { exec: vi.fn().mockResolvedValue(keySet) };
        return { exec: vi.fn().mockResolvedValue(null) };
      });

      teamModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: teamId, policySetId: 'team-set' }),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey({ policySetId: 'key-set' }),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.policy.limits).toHaveLength(4);
      expect(result.policy.limits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scope: 'team', measure: Measure.TOKEN, window: Window.DAY, limit: 10000, action: Action.BLOCK }),
          expect.objectContaining({ scope: 'team', measure: Measure.REQUEST, window: Window.MINUTE, limit: 60, action: Action.BLOCK }),
          expect.objectContaining({ scope: 'key', measure: Measure.SPEND, window: Window.MONTH, limit: 500, action: Action.BLOCK }),
          expect.objectContaining({ scope: 'key', measure: Measure.CONCURRENCY, window: Window.PERMANENT, limit: 5, action: Action.BLOCK }),
        ]),
      );
    });

    it('should build candidates sorted by priority', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();

      const modelWithBindings = makeModelDoc({
        providerId: p1,
        providerBindings: [
          { providerId: p1, priority: 0 },
          { providerId: p2, priority: 2 },
        ],
      });

      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(modelWithBindings),
      });

      providerModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          makeProviderDoc(p1),
          { ...makeProviderDoc(p2), name: 'Anthropic', type: ProviderType.ANTHROPIC },
        ]),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].providerId).toBe(String(p1));
      expect(result.candidates[0].priority).toBe(0);
      expect(result.candidates[1].providerId).toBe(String(p2));
      expect(result.candidates[1].priority).toBe(2);
    });

    it('should skip candidates that are unavailable', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();

      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(
          makeModelDoc({
            providerId: p1,
            providerBindings: [
              { providerId: p1, priority: 0 },
              { providerId: p2, priority: 1 },
            ],
          }),
        ),
      });

      providerModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          makeProviderDoc(p1),
          makeProviderDoc(p2),
        ]),
      });

      // p1 is unavailable (cooldown)
      providerUsageService.getAvailability
        .mockResolvedValueOnce({ available: false, reason: '渠道熔断冷却中' })
        .mockResolvedValueOnce({ available: true, reason: null });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].providerId).toBe(String(p2));
    });

    it('should skip candidates whose provider is disabled', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();

      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(
          makeModelDoc({
            providerId: p1,
            providerBindings: [
              { providerId: p1, priority: 0 },
              { providerId: p2, priority: 1 },
            ],
          }),
        ),
      });

      providerModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          // p1 is DISABLED → not included by find({ status: ACTIVE })
          makeProviderDoc(p2),
        ]),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].providerId).toBe(String(p2));
    });

    it('should include decrypted api key in candidates', async () => {
      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates[0].apiKey).toBe('sk-upstream');
    });

    it('should skip provider not in whitelist', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();

      modelModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(
          makeModelDoc({
            providerId: p1,
            providerBindings: [
              { providerId: p1, priority: 0 },
              { providerId: p2, priority: 1 },
            ],
          }),
        ),
      });

      providerModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          makeProviderDoc(p1),
          makeProviderDoc(p2),
        ]),
      });

      policySetModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          providerIds: [p1], // only p1 allowed
        }),
      });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey({ policySetId: apiKeyId }),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].providerId).toBe(String(p1));
    });

    it('should return empty candidates when none available', async () => {
      providerModel.find.mockReturnValue({ exec: vi.fn().mockResolvedValue([]) });

      const result = await resolver.resolve({
        tenantId,
        teamId,
        userId,
        apiKey: makeApiKey(),
        requestedModel: 'gpt-4o-mini',
      });

      expect(result.candidates).toHaveLength(0);
    });
  });
});