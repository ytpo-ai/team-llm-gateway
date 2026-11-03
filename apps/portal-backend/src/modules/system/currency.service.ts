import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SystemSetting } from './schemas/system-setting.schema.js';

export interface CurrencyRate {
  code: string;
  name: string;
  pointsPerUnit: number;
}

export interface CurrencyConfig {
  displayCurrency: string;
  rates: CurrencyRate[];
}

export const CURRENCY_SETTING_KEY = 'billing.currency';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectModel(SystemSetting.name)
    private readonly systemSettingModel: Model<SystemSetting>,
  ) {}

  async getConfig(tenantId: string): Promise<CurrencyConfig | null> {
    const doc = await this.systemSettingModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        key: CURRENCY_SETTING_KEY,
      })
      .exec();
    if (!doc || !this.isCurrencyConfig(doc.value)) return null;
    return doc.value;
  }

  async saveConfig(
    tenantId: string,
    updatedBy: string,
    config: CurrencyConfig,
  ): Promise<CurrencyConfig> {
    this.validate(config);
    await this.systemSettingModel
      .findOneAndUpdate(
        { tenantId: new Types.ObjectId(tenantId), key: CURRENCY_SETTING_KEY },
        {
          $set: {
            value: config,
            updatedBy: new Types.ObjectId(updatedBy),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    return config;
  }

  toCurrency(
    points: number,
    code: string,
    config: CurrencyConfig | null,
  ): number | null {
    const rate = this.findRate(config, code);
    if (!rate) return null;
    return points / rate.pointsPerUnit;
  }

  toPoints(
    amount: number,
    code: string,
    config: CurrencyConfig | null,
  ): number | null {
    const rate = this.findRate(config, code);
    if (!rate) return null;
    return amount * rate.pointsPerUnit;
  }

  private findRate(
    config: CurrencyConfig | null,
    code: string,
  ): CurrencyRate | null {
    if (!config) return null;
    const rate = config.rates.find((r) => r.code === code);
    return rate ?? null;
  }

  private validate(config: CurrencyConfig): void {
    if (!config.rates || config.rates.length === 0) {
      throw new BadRequestException('rates 不能为空');
    }
    const codes = config.rates.map((r) => r.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('币种 code 不能重复');
    }
    if (config.rates.some((r) => !(r.pointsPerUnit > 0))) {
      throw new BadRequestException('pointsPerUnit 必须大于 0');
    }
    if (!codes.includes(config.displayCurrency)) {
      throw new BadRequestException('displayCurrency 必须存在于 rates 中');
    }
  }

  private isCurrencyConfig(value: unknown): value is CurrencyConfig {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    if (typeof v.displayCurrency !== 'string') return false;
    if (!Array.isArray(v.rates)) return false;
    return v.rates.every((r) => {
      if (!r || typeof r !== 'object') return false;
      const item = r as Record<string, unknown>;
      return (
        typeof item.code === 'string' &&
        typeof item.name === 'string' &&
        typeof item.pointsPerUnit === 'number'
      );
    });
  }
}
