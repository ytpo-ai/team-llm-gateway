import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  CurrencyConfig,
  CurrencyService,
  CURRENCY_SETTING_KEY,
} from './currency.service.js';

describe('CurrencyService', () => {
  let service: CurrencyService;

  const tenantId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const systemSettingModel = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };

  const config: CurrencyConfig = {
    displayCurrency: 'CNY',
    rates: [
      { code: 'USD', name: '美元', pointsPerUnit: 10000 },
      { code: 'CNY', name: '人民币', pointsPerUnit: 1389 },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: 'SystemSettingModel', useValue: systemSettingModel },
      ],
    }).compile();

    service = module.get(CurrencyService);
  });

  describe('getConfig', () => {
    it('should return null when not configured', async () => {
      systemSettingModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.getConfig(String(tenantId))).resolves.toBeNull();
      expect(systemSettingModel.findOne).toHaveBeenCalledWith({
        tenantId: expect.any(Types.ObjectId),
        key: CURRENCY_SETTING_KEY,
      });
    });

    it('should return config when present', async () => {
      systemSettingModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ value: config }),
      });

      await expect(service.getConfig(String(tenantId))).resolves.toEqual(config);
    });

    it('should return null when stored value is malformed', async () => {
      systemSettingModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ value: { foo: 'bar' } }),
      });

      await expect(service.getConfig(String(tenantId))).resolves.toBeNull();
    });
  });

  describe('saveConfig', () => {
    it('should upsert the billing.currency setting', async () => {
      systemSettingModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ value: config }),
      });

      const result = await service.saveConfig(String(tenantId), String(userId), config);

      expect(result).toEqual(config);
      expect(systemSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId: expect.any(Types.ObjectId), key: CURRENCY_SETTING_KEY },
        expect.objectContaining({
          $set: expect.objectContaining({ value: config }),
        }),
        { upsert: true, new: true },
      );
    });

    it('should reject duplicate currency codes', async () => {
      const bad: CurrencyConfig = {
        displayCurrency: 'USD',
        rates: [
          { code: 'USD', name: '美元', pointsPerUnit: 10000 },
          { code: 'USD', name: '美金', pointsPerUnit: 9999 },
        ],
      };
      await expect(
        service.saveConfig(String(tenantId), String(userId), bad),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-positive pointsPerUnit', async () => {
      const bad: CurrencyConfig = {
        displayCurrency: 'USD',
        rates: [{ code: 'USD', name: '美元', pointsPerUnit: 0 }],
      };
      await expect(
        service.saveConfig(String(tenantId), String(userId), bad),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject displayCurrency not present in rates', async () => {
      const bad: CurrencyConfig = {
        displayCurrency: 'EUR',
        rates: [{ code: 'USD', name: '美元', pointsPerUnit: 10000 }],
      };
      await expect(
        service.saveConfig(String(tenantId), String(userId), bad),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('conversion', () => {
    it('should convert points to currency', () => {
      expect(service.toCurrency(10000, 'USD', config)).toBe(1);
      expect(service.toCurrency(1389, 'CNY', config)).toBe(1);
    });

    it('should convert currency to points', () => {
      expect(service.toPoints(1, 'USD', config)).toBe(10000);
      expect(service.toPoints(1, 'CNY', config)).toBe(1389);
    });

    it('should return null when config is null', () => {
      expect(service.toCurrency(10000, 'USD', null)).toBeNull();
      expect(service.toPoints(1, 'USD', null)).toBeNull();
    });

    it('should return null when code is missing', () => {
      expect(service.toCurrency(10000, 'EUR', config)).toBeNull();
      expect(service.toPoints(1, 'EUR', config)).toBeNull();
    });
  });
});
