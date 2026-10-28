import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema.js';

export const DEFAULT_TENANT_CODE = 'default';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async ensureDefaultTenant(name = '默认团队'): Promise<TenantDocument> {
    const existing = await this.tenantModel
      .findOne({ code: DEFAULT_TENANT_CODE })
      .exec();
    if (existing) {
      return existing;
    }
    return this.tenantModel.create({ code: DEFAULT_TENANT_CODE, name });
  }
}
