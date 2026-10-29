import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SystemSettingsService } from './system-settings.service.js';

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;

  const tenantId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const systemSettingModel = {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        { provide: 'SystemSettingModel', useValue: systemSettingModel },
      ],
    }).compile();

    service = module.get(SystemSettingsService);
  });

  describe('list', () => {
    it('should list settings sorted by key', async () => {
      systemSettingModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          {
            key: 'notification.quotaThreshold',
            value: 80,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        ]),
      });

      const result = await service.list(String(tenantId));

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('notification.quotaThreshold');
      expect(result[0].value).toBe(80);
      expect(result[0].updatedBy).toBe(String(userId));
    });
  });

  describe('upsert', () => {
    it('should upsert each key with updatedBy', async () => {
      systemSettingModel.findOneAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValueOnce({
            key: 'audit.retentionDays',
            value: 90,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .mockResolvedValueOnce({
            key: 'notification.quotaThreshold',
            value: 70,
            updatedBy: userId,
            updatedAt: new Date(),
          }),
      });

      const result = await service.upsert(String(tenantId), String(userId), {
        'audit.retentionDays': 90,
        'notification.quotaThreshold': 70,
      });

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('audit.retentionDays');
      expect(systemSettingModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(systemSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'audit.retentionDays',
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ value: 90 }),
        }),
        { upsert: true, new: true },
      );
    });
  });
});
