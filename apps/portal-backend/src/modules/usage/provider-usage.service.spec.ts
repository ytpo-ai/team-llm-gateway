import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ProviderUsageService } from './provider-usage.service.js';

describe('ProviderUsageService', () => {
  let service: ProviderUsageService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const providerId = String(new Types.ObjectId());

  const providerUsageModel = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
  };
  const providerModel = { find: vi.fn() };
  const configService = { get: vi.fn(() => undefined) };

  const exec = (value: unknown) => ({ exec: vi.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderUsageService,
        { provide: 'ProviderUsageModel', useValue: providerUsageModel },
        { provide: 'ProviderModel', useValue: providerModel },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(ProviderUsageService);
  });

  describe('getAvailability', () => {
    it('should be available when no snapshot exists (optimistic)', async () => {
      providerUsageModel.findOne.mockReturnValue(exec(null));

      const result = await service.getAvailability(tenantId, teamId, providerId);

      expect(result).toEqual({ available: true, reason: null });
    });

    it('should be unavailable while exhaustedUntil is in the future', async () => {
      providerUsageModel.findOne.mockReturnValue(
        exec({
          exhaustedUntil: new Date(Date.now() + 60_000),
          cooldownUntil: null,
          consecutiveFailures: 1,
          errorMessage: '上游返回 429',
        }),
      );

      const result = await service.getAvailability(tenantId, teamId, providerId);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('上游返回 429');
    });

    it('should be unavailable while cooldownUntil is in the future', async () => {
      providerUsageModel.findOne.mockReturnValue(
        exec({
          exhaustedUntil: null,
          cooldownUntil: new Date(Date.now() + 30_000),
          consecutiveFailures: 5,
          errorMessage: null,
        }),
      );

      const result = await service.getAvailability(tenantId, teamId, providerId);

      expect(result.available).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('should be available when both deadlines have passed', async () => {
      providerUsageModel.findOne.mockReturnValue(
        exec({
          exhaustedUntil: new Date(Date.now() - 1_000),
          cooldownUntil: new Date(Date.now() - 1_000),
          consecutiveFailures: 0,
          errorMessage: null,
        }),
      );

      const result = await service.getAvailability(tenantId, teamId, providerId);

      expect(result.available).toBe(true);
    });
  });

  describe('markExhausted', () => {
    const mockApplyFailure = (failures: number) => {
      providerUsageModel.findOneAndUpdate.mockReturnValue(
        exec({ _id: new Types.ObjectId(), consecutiveFailures: failures }),
      );
      providerUsageModel.updateOne.mockReturnValue(exec({}));
    };

    const captureExhaustedUntil = (): Date => {
      const call = providerUsageModel.updateOne.mock.calls[0];
      const update = call[1] as { $set: { exhaustedUntil: Date } };
      return update.$set.exhaustedUntil;
    };

    it('should use Retry-After header when present', async () => {
      mockApplyFailure(1);

      await service.markExhausted(tenantId, teamId, providerId, '429', {
        'retry-after': '30',
      });

      const until = captureExhaustedUntil();
      expect(
        Math.abs(until.getTime() - (Date.now() + 30_000)),
      ).toBeLessThan(1_000);
    });

    it('should use x-ratelimit-reset epoch seconds when Retry-After absent', async () => {
      mockApplyFailure(1);
      const resetEpoch = Math.floor((Date.now() + 45_000) / 1000);

      await service.markExhausted(tenantId, teamId, providerId, '429', {
        'x-ratelimit-reset-requests': String(resetEpoch),
      });

      const until = captureExhaustedUntil();
      expect(Math.abs(until.getTime() - resetEpoch * 1000)).toBeLessThan(1_000);
    });

    it('should fall back to the default window without headers', async () => {
      mockApplyFailure(1);

      await service.markExhausted(tenantId, teamId, providerId, '429');

      const until = captureExhaustedUntil();
      // failures=1 → 60s × 2^0 = 60s
      expect(
        Math.abs(until.getTime() - (Date.now() + 60_000)),
      ).toBeLessThan(1_000);
    });

    it('should back off exponentially on repeated 429', async () => {
      mockApplyFailure(3);

      await service.markExhausted(tenantId, teamId, providerId, '429');

      const until = captureExhaustedUntil();
      // failures=3 → 60s × 2^2 = 240s
      expect(
        Math.abs(until.getTime() - (Date.now() + 240_000)),
      ).toBeLessThan(1_000);
    });
  });

  describe('recordFailure', () => {
    const mockApplyFailure = (failures: number) => {
      providerUsageModel.findOneAndUpdate.mockReturnValue(
        exec({ _id: new Types.ObjectId(), consecutiveFailures: failures }),
      );
      providerUsageModel.updateOne.mockReturnValue(exec({}));
    };

    it('should not enter cooldown below the threshold', async () => {
      mockApplyFailure(2);

      await service.recordFailure(tenantId, teamId, providerId, '上游返回 500');

      const update = providerUsageModel.updateOne.mock.calls[0][1] as {
        $set: Record<string, unknown>;
      };
      expect(update.$set.cooldownUntil).toBeUndefined();
      expect(update.$set.errorMessage).toBe('上游返回 500');
    });

    it('should enter cooldown at the threshold with base backoff', async () => {
      mockApplyFailure(3);

      await service.recordFailure(tenantId, teamId, providerId, '上游返回 500');

      const update = providerUsageModel.updateOne.mock.calls[0][1] as {
        $set: { cooldownUntil: Date };
      };
      // failures=3 → 30s × 2^0 = 30s
      expect(
        Math.abs(update.$set.cooldownUntil.getTime() - (Date.now() + 30_000)),
      ).toBeLessThan(1_000);
    });

    it('should back off exponentially beyond the threshold', async () => {
      mockApplyFailure(5);

      await service.recordFailure(tenantId, teamId, providerId, '上游返回 500');

      const update = providerUsageModel.updateOne.mock.calls[0][1] as {
        $set: { cooldownUntil: Date };
      };
      // failures=5 → 30s × 2^2 = 120s
      expect(
        Math.abs(update.$set.cooldownUntil.getTime() - (Date.now() + 120_000)),
      ).toBeLessThan(1_000);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failure state', async () => {
      providerUsageModel.updateOne.mockReturnValue(exec({}));

      await service.recordSuccess(tenantId, teamId, providerId);

      const [filter, update, options] = providerUsageModel.updateOne.mock
        .calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
        { upsert: boolean },
      ];
      expect(filter.providerId).toEqual(new Types.ObjectId(providerId));
      expect(update.$set.consecutiveFailures).toBe(0);
      expect(update.$set.exhaustedUntil).toBeNull();
      expect(update.$set.cooldownUntil).toBeNull();
      expect(update.$set.errorMessage).toBeNull();
      expect(options.upsert).toBe(true);
    });
  });

  describe('updateFromHeaders', () => {
    it('should do nothing when no rate-limit headers present', async () => {
      await service.updateFromHeaders(tenantId, teamId, providerId, {
        'content-type': 'application/json',
      });

      expect(providerUsageModel.updateOne).not.toHaveBeenCalled();
    });

    it('should update rate-limit remaining from headers', async () => {
      providerUsageModel.updateOne.mockReturnValue(exec({}));

      await service.updateFromHeaders(tenantId, teamId, providerId, {
        'x-ratelimit-remaining-requests': '42',
      });

      const update = providerUsageModel.updateOne.mock.calls[0][1] as {
        $set: { rateLimitRemaining: number };
      };
      expect(update.$set.rateLimitRemaining).toBe(42);
    });
  });
});
