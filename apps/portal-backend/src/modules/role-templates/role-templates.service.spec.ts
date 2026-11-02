import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RoleTemplatesService } from './role-templates.service.js';

describe('RoleTemplatesService', () => {
  let service: RoleTemplatesService;

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const templateId = new Types.ObjectId();

  const roleTemplateModel = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
  };

  const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
    _id: templateId,
    tenantId: new Types.ObjectId(tenantId),
    teamId: new Types.ObjectId(teamId),
    name: '设计师',
    description: '',
    limitDaily: null,
    limitWeekly: null,
    limitMonthly: null,
    rateLimitPerMinute: null,
    providerIds: [],
    modelWhitelist: [],
    builtIn: false,
    createdAt: new Date(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleTemplatesService,
        { provide: 'RoleTemplateModel', useValue: roleTemplateModel },
      ],
    }).compile();

    service = module.get(RoleTemplatesService);
  });

  describe('ensureBuiltInTemplates', () => {
    it('should create built-in templates when missing', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await service.ensureBuiltInTemplates();

      expect(roleTemplateModel.create).toHaveBeenCalledTimes(2);
      const first = roleTemplateModel.create.mock.calls[0][0];
      expect(first.builtIn).toBe(true);
      expect(first.tenantId).toBeNull();
    });

    it('should skip existing built-in templates', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTemplate({ builtIn: true })),
      });

      await service.ensureBuiltInTemplates();

      expect(roleTemplateModel.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should filter built-in and team templates', async () => {
      roleTemplateModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([makeTemplate()]),
      });

      await service.list(tenantId, teamId);

      const filter = roleTemplateModel.find.mock.calls[0][0];
      expect(filter.$or).toEqual([
        { builtIn: true },
        {
          tenantId: new Types.ObjectId(tenantId),
          teamId: new Types.ObjectId(teamId),
        },
      ]);
    });
  });

  describe('create', () => {
    it('should create a team-level template', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      roleTemplateModel.create.mockImplementation(async (input: any) => ({
        ...makeTemplate(),
        ...input,
      }));

      const result = await service.create(tenantId, teamId, {
        name: '数据分析师',
        limitMonthly: 1000000,
        providerIds: [],
      });

      expect(result.name).toBe('数据分析师');
      expect(result.limitMonthly).toBe(1000000);
      expect(result.builtIn).toBe(false);
    });

    it('should reject duplicate name', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTemplate()),
      });

      await expect(
        service.create(tenantId, teamId, { name: '设计师' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should reject removing built-in template', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(makeTemplate({ builtIn: true })),
      });

      await expect(
        service.remove(tenantId, teamId, String(templateId)),
      ).rejects.toThrow(ConflictException);
    });

    it('should remove a team template', async () => {
      const template = makeTemplate();
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(template),
      });

      const result = await service.remove(tenantId, teamId, String(templateId));

      expect(template.deleteOne).toHaveBeenCalled();
      expect(result.name).toBe('设计师');
    });
  });

  describe('get', () => {
    it('should throw NotFound when template not accessible', async () => {
      roleTemplateModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.get(tenantId, teamId, String(templateId)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
