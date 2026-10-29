import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ModelStatus } from '../models/schemas/model.schema.js';
import { RecommendationService } from './recommendation.service.js';

describe('RecommendationService', () => {
  let service: RecommendationService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());

  const modelModel = {
    find: vi.fn(),
  };

  const makeModel = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    multiplier: 1,
    capabilities: ['chat'],
    status: ModelStatus.ACTIVE,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: 'ModelModel', useValue: modelModel },
      ],
    }).compile();

    service = module.get(RecommendationService);
  });

  describe('listScenarios', () => {
    it('should return the static scenario catalog', () => {
      const scenarios = service.listScenarios();
      expect(scenarios.length).toBeGreaterThanOrEqual(8);
      expect(scenarios.find((s) => s.id === 'code')).toBeDefined();
      expect(scenarios.find((s) => s.id === 'vision')?.cacheHint).toBeTruthy();
    });
  });

  describe('recommend', () => {
    it('should throw NotFound for unknown scenario', async () => {
      await expect(
        service.recommend(tenantId, teamId, 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query active models filtered by tenant and team', async () => {
      modelModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([makeModel()]),
      });

      await service.recommend(tenantId, teamId, 'chat');

      const filter = modelModel.find.mock.calls[0][0];
      expect(String(filter.tenantId)).toBe(tenantId);
      expect(String(filter.teamId)).toBe(teamId);
      expect(filter.status).toBe(ModelStatus.ACTIVE);
    });

    it('should pick cheapest full-match as primary and sort alternatives by multiplier', async () => {
      modelModel.find.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue([
            makeModel({ modelId: 'expensive', multiplier: 3, capabilities: ['chat'] }),
            makeModel({ modelId: 'cheap', multiplier: 1, capabilities: ['chat'] }),
            makeModel({ modelId: 'mid', multiplier: 2, capabilities: ['chat'] }),
          ]),
      });

      const result = await service.recommend(tenantId, teamId, 'chat');

      expect(result.primary?.modelId).toBe('cheap');
      expect(result.alternatives.map((m) => m.modelId)).toEqual([
        'mid',
        'expensive',
      ]);
      expect(result.partialMatches).toEqual([]);
    });

    it('should return partial matches when no model fully matches', async () => {
      modelModel.find.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue([
            makeModel({ modelId: 'code-only', capabilities: ['code'] }),
            makeModel({ modelId: 'reasoning-only', capabilities: ['reasoning'] }),
          ]),
      });

      const result = await service.recommend(tenantId, teamId, 'code-review');

      expect(result.primary).toBeNull();
      expect(result.alternatives).toEqual([]);
      expect(result.partialMatches.map((m) => m.modelId)).toEqual([
        'code-only',
        'reasoning-only',
      ]);
    });
  });
});
