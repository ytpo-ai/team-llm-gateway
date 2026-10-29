import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SystemSetting,
  SystemSettingDocument,
} from './schemas/system-setting.schema.js';

export interface SystemSettingView {
  key: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt?: Date;
}

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectModel(SystemSetting.name)
    private readonly systemSettingModel: Model<SystemSetting>,
  ) {}

  async list(tenantId: string): Promise<SystemSettingView[]> {
    const docs = await this.systemSettingModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ key: 1 })
      .exec();
    return docs.map((doc) => this.toView(doc));
  }

  async upsert(
    tenantId: string,
    updatedBy: string,
    settings: Record<string, unknown>,
  ): Promise<SystemSettingView[]> {
    const keys = Object.keys(settings);
    const tenantObjectId = new Types.ObjectId(tenantId);

    const docs = await Promise.all(
      keys.map(async (key) => {
        const doc = await this.systemSettingModel
          .findOneAndUpdate(
            { tenantId: tenantObjectId, key },
            {
              $set: {
                value: settings[key],
                updatedBy: new Types.ObjectId(updatedBy),
              },
            },
            { upsert: true, new: true },
          )
          .exec();
        return doc as SystemSettingDocument;
      }),
    );

    return docs.sort((a, b) => a.key.localeCompare(b.key)).map((doc) => this.toView(doc));
  }

  private toView(doc: SystemSettingDocument): SystemSettingView {
    return {
      key: doc.key,
      value: doc.value,
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
      updatedAt: doc.updatedAt,
    };
  }
}
