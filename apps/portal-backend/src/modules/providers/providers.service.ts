import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildApiKeyHint, encrypt } from '../../common/crypto/cipher.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import {
  Provider,
  ProviderDocument,
  ProviderStatus,
  ProviderType,
} from './schemas/provider.schema.js';

export interface ProviderView {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyHint: string;
  status: ProviderStatus;
  createdAt?: Date;
}

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly configService: ConfigService,
  ) {}

  async list(tenantId: string, teamId: string): Promise<ProviderView[]> {
    const providers = await this.providerModel
      .find({ tenantId, teamId })
      .sort({ createdAt: -1 })
      .exec();
    return providers.map((provider) => this.toView(provider));
  }

  async get(tenantId: string, teamId: string, id: string): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);
    return this.toView(provider);
  }

  async create(
    tenantId: string,
    teamId: string,
    dto: CreateProviderDto,
  ): Promise<ProviderView> {
    await this.assertNameAvailable(tenantId, teamId, dto.name);

    const secret = this.encryptionSecret();
    const provider = await this.providerModel.create({
      tenantId,
      teamId,
      name: dto.name,
      type: dto.type ?? ProviderType.OPENAI_COMPATIBLE,
      baseUrl: dto.baseUrl,
      apiKeyCiphertext: encrypt(secret, dto.apiKey),
      apiKeyHint: buildApiKeyHint(dto.apiKey),
      status: ProviderStatus.ACTIVE,
    });

    return this.toView(provider);
  }

  async update(
    tenantId: string,
    teamId: string,
    id: string,
    dto: UpdateProviderDto,
  ): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);

    if (dto.name !== undefined && dto.name !== provider.name) {
      await this.assertNameAvailable(tenantId, teamId, dto.name);
      provider.name = dto.name;
    }
    if (dto.type !== undefined) provider.type = dto.type;
    if (dto.baseUrl !== undefined) provider.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined) {
      const secret = this.encryptionSecret();
      provider.apiKeyCiphertext = encrypt(secret, dto.apiKey);
      provider.apiKeyHint = buildApiKeyHint(dto.apiKey);
    }
    if (dto.status !== undefined) provider.status = dto.status;

    await provider.save();
    return this.toView(provider);
  }

  async remove(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);
    provider.status = ProviderStatus.DISABLED;
    await provider.save();
    return this.toView(provider);
  }

  private encryptionSecret(): string {
    return this.configService.getOrThrow<string>('encryption.secret');
  }

  private async assertNameAvailable(
    tenantId: string,
    teamId: string,
    name: string,
  ): Promise<void> {
    const existing = await this.providerModel
      .findOne({ tenantId, teamId, name })
      .exec();
    if (existing) {
      throw new ConflictException('渠道名称已存在');
    }
  }

  private async findInTeam(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderDocument> {
    const provider = await this.providerModel
      .findOne({ _id: id, tenantId, teamId })
      .exec();
    if (!provider) {
      throw new NotFoundException('渠道不存在');
    }
    return provider;
  }

  private toView(provider: ProviderDocument): ProviderView {
    return {
      id: String(provider._id),
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKeyHint: provider.apiKeyHint,
      status: provider.status,
      createdAt: provider.createdAt,
    };
  }
}
