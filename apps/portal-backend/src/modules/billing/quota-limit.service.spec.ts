import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ApiKeyStatus } from '../api-keys/schemas/api-key.schema.js';
import {
  PolicyAction,
  PolicyMeasure,
  PolicySetDocument,
  PolicyWindow,
} from '../policy-sets/schemas/policy-set.schema.js';
import { QuotaLimitService } from './quota-limit.service.js';
import type { ResolvedPolicyContext } from './quota-limit.service.js';
import { UsageService } from '../usage/usage.service.js';

describe('QuotaLimitService', () => {
  let service: QuotaLimitService;

  const teamId = String(new Types.ObjectId());
  const userId = String(new Types.ObjectId());
  const templateId = new Types.ObjectId();
  const providerId = new Types.ObjectId();

  const teamModel = { findById: vi.fn() };
  const userModel = { findById: vi.fn() };
  const roleTemplateModel = { findById: vi.fn() };
  const policySetModel = { findById: vi.fn() };
  const usageService = {
    sumTokens: vi.fn(),
    sumCost: vi.fn(),
    countRequests: vi.fn(),
  };

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
    policySetId: null,
    lastUsedAt: null,
    ...overrides,
  });

  const makeSet = (overrides: Record<string, unknown> = {}) =>
    ({
      _id: new Types.ObjectId(),
      tenantId: null,
      teamId: null,
      name: '策略集',
      description: '',
      entries: [],
      providerIds: [],
      modelWhitelist: [],
      builtIn: false,
      ...overrides,
    }) as unknown as PolicySetDocument;

  const exec = (value: unknown) => ({ exec: vi.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaLimitService,
        { provide: 'TeamModel', useValue: teamModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'RoleTemplateModel', useValue: roleTemplateModel },
        { provide: 'PolicySetModel', useValue: policySetModel },
        { provide: UsageService, useValue: usageService },
      ],
    }).compile();

    service = module.get(QuotaLimitService);
  });

  describe('resolve', () => {
    it('should resolve team/role/key policy sets', async () => {
      const teamSet = makeSet({ name: '团队策略' });
      const roleSet = makeSet({ name: '角色策略' });
      const keySet = makeSet({ name: 'Key 策略' });

      teamModel.findById.mockReturnValue(
        exec({ _id: new Types.ObjectId(teamId), policySetId: teamSet._id }),
      );
      userModel.findById.mockReturnValue(
        exec({ roleTemplateId: templateId }),
      );
      roleTemplateModel.findById.mockReturnValue(
        exec({ _id: templateId, policySetId: roleSet._id }),
      );
      policySetModel.findById
        .mockReturnValueOnce(exec(teamSet))
        .mockReturnValueOnce(exec(roleSet))
        .mockReturnValueOnce(exec(keySet));

      const result = await service.resolve({
        teamId,
        userId,
        apiKey: makeApiKey({ policySetId: keySet._id }),
      });

      expect(result.team?.name).toBe('团队策略');
      expect(result.role?.name).toBe('角色策略');
      expect(result.key?.name).toBe('Key 策略');
    });

    it('should return null sets when nothing bound', async () => {
      teamModel.findById.mockReturnValue(exec({ _id: new Types.ObjectId(teamId) }));
      userModel.findById.mockReturnValue(exec({ roleTemplateId: null }));

      const result = await service.resolve({
        teamId,
        userId,
        apiKey: makeApiKey(),
      });

      expect(result.team).toBeNull();
      expect(result.role).toBeNull();
      expect(result.key).toBeNull();
    });
  });

  describe('resolveRateLimits', () => {
    it('should extract minute request and concurrency block limits', () => {
      const resolved: ResolvedPolicyContext = {
        team: makeSet({
          entries: [
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.MINUTE,
              limit: 100,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
        role: makeSet({
          entries: [
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.MINUTE,
              limit: 30,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
        key: makeSet({
          entries: [
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.MINUTE,
              limit: 60,
              action: PolicyAction.BLOCK,
            },
            {
              measure: PolicyMeasure.CONCURRENCY,
              window: PolicyWindow.PERMANENT,
              limit: 5,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
      };

      const limits = service.resolveRateLimits(resolved);

      expect(limits.teamPerMinute).toBe(100);
      expect(limits.memberPerMinute).toBe(30);
      expect(limits.keyPerMinute).toBe(60);
      expect(limits.keyConcurrency).toBe(5);
    });

    it('should ignore warn and zero/unlimited entries', () => {
      const resolved: ResolvedPolicyContext = {
        team: null,
        role: null,
        key: makeSet({
          entries: [
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.MINUTE,
              limit: 60,
              action: PolicyAction.WARN,
            },
            {
              measure: PolicyMeasure.CONCURRENCY,
              window: PolicyWindow.PERMANENT,
              limit: 0,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
      };

      const limits = service.resolveRateLimits(resolved);

      expect(limits.keyPerMinute).toBeNull();
      expect(limits.keyConcurrency).toBeNull();
    });
  });

  describe('isProviderAllowed', () => {
    it('should intersect provider whitelists across levels', () => {
      const allowed: ResolvedPolicyContext = {
        team: makeSet({ providerIds: [providerId] }),
        role: makeSet({ providerIds: [providerId] }),
        key: null,
      };
      expect(service.isProviderAllowed(allowed, String(providerId))).toBe(true);

      const denied: ResolvedPolicyContext = {
        team: null,
        role: makeSet({ providerIds: [new Types.ObjectId()] }),
        key: null,
      };
      expect(service.isProviderAllowed(denied, String(providerId))).toBe(false);
    });
  });

  describe('isModelAllowed', () => {
    it('should intersect model whitelists across levels', () => {
      const resolved: ResolvedPolicyContext = {
        team: null,
        role: makeSet({ modelWhitelist: ['gpt-4o-mini'] }),
        key: makeSet({ modelWhitelist: ['gpt-4o-mini'] }),
      };
      expect(service.isModelAllowed(resolved, 'gpt-4o-mini')).toBe(true);
      expect(service.isModelAllowed(resolved, 'gpt-4o')).toBe(false);
    });
  });

  describe('assertUsageLimits', () => {
    const subject = {
      tenantId: String(new Types.ObjectId()),
      teamId,
      userId,
      apiKeyId: String(new Types.ObjectId()),
    };

    it('should block when team token day limit exceeded', async () => {
      usageService.sumTokens.mockResolvedValue(1000);
      const resolved: ResolvedPolicyContext = {
        team: makeSet({
          entries: [
            {
              measure: PolicyMeasure.TOKEN,
              window: PolicyWindow.DAY,
              limit: 1000,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
        role: null,
        key: null,
      };

      await expect(
        service.assertUsageLimits(resolved, subject),
      ).rejects.toThrow(HttpException);
      expect(usageService.sumTokens).toHaveBeenCalledWith(
        expect.objectContaining({ teamId, since: expect.any(Date) }),
      );
    });

    it('should block when member spend month limit exceeded', async () => {
      usageService.sumCost.mockResolvedValue(500);
      const resolved: ResolvedPolicyContext = {
        team: null,
        role: makeSet({
          entries: [
            {
              measure: PolicyMeasure.SPEND,
              window: PolicyWindow.MONTH,
              limit: 500,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
        key: null,
      };

      await expect(
        service.assertUsageLimits(resolved, subject),
      ).rejects.toThrow(HttpException);
      expect(usageService.sumCost).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
      );
    });

    it('should block when key request long-window count exceeded', async () => {
      usageService.countRequests.mockResolvedValue(10);
      const resolved: ResolvedPolicyContext = {
        team: null,
        role: null,
        key: makeSet({
          entries: [
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.HOUR,
              limit: 10,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
      };

      await expect(
        service.assertUsageLimits(resolved, subject),
      ).rejects.toThrow(HttpException);
      expect(usageService.countRequests).toHaveBeenCalledWith(
        expect.objectContaining({ apiKeyId: subject.apiKeyId }),
      );
    });

    it('should not throw for warn action (record event only)', async () => {
      usageService.sumTokens.mockResolvedValue(1000);
      const resolved: ResolvedPolicyContext = {
        team: makeSet({
          entries: [
            {
              measure: PolicyMeasure.TOKEN,
              window: PolicyWindow.DAY,
              limit: 1000,
              action: PolicyAction.WARN,
            },
          ],
        }),
        role: null,
        key: null,
      };

      await expect(
        service.assertUsageLimits(resolved, subject),
      ).resolves.toBeUndefined();
    });

    it('should skip unlimited (limit <= 0) and minute/concurrency entries', async () => {
      const resolved: ResolvedPolicyContext = {
        team: null,
        role: null,
        key: makeSet({
          entries: [
            {
              measure: PolicyMeasure.TOKEN,
              window: PolicyWindow.PERMANENT,
              limit: 0,
              action: PolicyAction.BLOCK,
            },
            {
              measure: PolicyMeasure.REQUEST,
              window: PolicyWindow.MINUTE,
              limit: 60,
              action: PolicyAction.BLOCK,
            },
            {
              measure: PolicyMeasure.CONCURRENCY,
              window: PolicyWindow.PERMANENT,
              limit: 5,
              action: PolicyAction.BLOCK,
            },
          ],
        }),
      };

      await expect(
        service.assertUsageLimits(resolved, subject),
      ).resolves.toBeUndefined();
      expect(usageService.sumTokens).not.toHaveBeenCalled();
      expect(usageService.countRequests).not.toHaveBeenCalled();
    });
  });
});
