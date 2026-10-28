import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyStatus } from './schemas/api-key.schema.js';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const tenantId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const keyId = new Types.ObjectId();

  const apiKeyModel = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  };

  const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: String(userId),
    email: 'member@example.com',
    tenantId: String(tenantId),
    teamId: String(teamId),
    role: Role.MEMBER,
    ...overrides,
  });

  const makeKey = (overrides: Record<string, unknown> = {}) => ({
    _id: keyId,
    tenantId,
    teamId,
    userId,
    name: null,
    keyHash: 'hash',
    keyPrefix: 'pk_ab12cd34ef',
    status: ApiKeyStatus.ACTIVE,
    expiresAt: null,
    allowedModels: [],
    rateLimitPerMinute: null,
    maxTokens: null,
    lastUsedAt: null,
    createdAt: new Date(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: 'ApiKeyModel', useValue: apiKeyModel },
      ],
    }).compile();

    service = module.get(ApiKeysService);
  });

  describe('create', () => {
    it('should persist a hashed key and return the raw key once', async () => {
      const key = makeKey();
      apiKeyModel.create.mockImplementation(async (input: any) => ({
        ...key,
        ...input,
        _id: keyId,
      }));

      const result = await service.create(makeUser(), { name: 'dev' });

      expect(result.key).toMatch(/^pk_/);
      expect(result.apiKey.keyPrefix).toBe(result.key.slice(0, 12));
      expect(result.apiKey.keyPrefix).not.toBe(result.key);

      const createArg = apiKeyModel.create.mock.calls[0][0];
      expect(createArg.keyHash).toBe(
        createHash('sha256').update(result.key).digest('hex'),
      );
      expect(createArg.key).toBeUndefined();
      expect(createArg.userId).toBe(String(userId));
    });
  });

  describe('list', () => {
    it('should list only own keys for a regular member', async () => {
      apiKeyModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeKey()]),
      });

      await service.list(makeUser());

      const filter = apiKeyModel.find.mock.calls[0][0];
      expect(filter).toEqual({ tenantId: String(tenantId), userId: String(userId) });
    });

    it('should list team keys for team_admin', async () => {
      apiKeyModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeKey()]),
      });

      await service.list(makeUser({ role: Role.TEAM_ADMIN }));

      const filter = apiKeyModel.find.mock.calls[0][0];
      expect(filter).toEqual({ tenantId: String(tenantId), teamId: String(teamId) });
    });
  });

  describe('get', () => {
    it('should forbid access to another member key', async () => {
      apiKeyModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeKey({ userId: otherUserId })),
      });

      await expect(
        service.get(makeUser(), String(keyId)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFound when key missing', async () => {
      apiKeyModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.get(makeUser(), String(keyId))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revoke', () => {
    it('should set status to revoked', async () => {
      const key = makeKey();
      apiKeyModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(key),
      });

      const result = await service.revoke(makeUser(), String(keyId));

      expect(key.status).toBe(ApiKeyStatus.REVOKED);
      expect(result.status).toBe(ApiKeyStatus.REVOKED);
    });
  });

  describe('rotate', () => {
    it('should revoke old key and create a new one', async () => {
      const oldKey = makeKey({ userId: userId });
      apiKeyModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(oldKey),
      });
      apiKeyModel.create.mockImplementation(async (input: any) => ({
        ...oldKey,
        ...input,
        status: ApiKeyStatus.ACTIVE,
      }));

      const result = await service.rotate(makeUser(), String(keyId));

      expect(oldKey.status).toBe(ApiKeyStatus.REVOKED);
      expect(result.key).toMatch(/^pk_/);
      expect(result.apiKey.status).toBe(ApiKeyStatus.ACTIVE);
    });
  });
});
