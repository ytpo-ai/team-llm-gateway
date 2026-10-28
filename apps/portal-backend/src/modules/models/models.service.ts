import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider } from '../providers/schemas/provider.schema.js';
import { CreateModelDto } from './dto/create-model.dto.js';
import { UpdateModelDto } from './dto/update-model.dto.js';
import {
  Model as ModelEntity,
  ModelDocument,
  ModelStatus,
} from './schemas/model.schema.js';

export interface ModelView {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  multiplier: number;
  capabilities: string[];
  aliases: string[];
  status: ModelStatus;
  createdAt?: Date;
}

@Injectable()
export class ModelsService {
  constructor(
    @InjectModel(ModelEntity.name)
    private readonly modelModel: Model<ModelEntity>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
  ) {}

  async list(tenantId: string, teamId: string): Promise<ModelView[]> {
    const models = await this.modelModel
      .find({ tenantId, teamId })
      .sort({ createdAt: -1 })
      .exec();
    return models.map((model) => this.toView(model));
  }

  async get(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    return this.toView(model);
  }

  async create(
    tenantId: string,
    teamId: string,
    dto: CreateModelDto,
  ): Promise<ModelView> {
    await this.assertProviderInTeam(tenantId, teamId, dto.providerId);
    await this.assertModelIdAvailable(tenantId, teamId, dto.modelId);

    const model = await this.modelModel.create({
      tenantId,
      teamId,
      providerId: dto.providerId,
      modelId: dto.modelId,
      displayName: dto.displayName ?? '',
      multiplier: dto.multiplier ?? 1,
      capabilities: dto.capabilities ?? [],
      aliases: dto.aliases ?? [],
      status: ModelStatus.ACTIVE,
    });

    return this.toView(model);
  }

  async update(
    tenantId: string,
    teamId: string,
    id: string,
    dto: UpdateModelDto,
  ): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);

    if (dto.providerId !== undefined && dto.providerId !== String(model.providerId)) {
      await this.assertProviderInTeam(tenantId, teamId, dto.providerId);
      model.providerId = new Types.ObjectId(dto.providerId);
    }
    if (dto.modelId !== undefined && dto.modelId !== model.modelId) {
      await this.assertModelIdAvailable(tenantId, teamId, dto.modelId);
      model.modelId = dto.modelId;
    }
    if (dto.displayName !== undefined) model.displayName = dto.displayName;
    if (dto.multiplier !== undefined) model.multiplier = dto.multiplier;
    if (dto.capabilities !== undefined) model.capabilities = dto.capabilities;
    if (dto.aliases !== undefined) model.aliases = dto.aliases;
    if (dto.status !== undefined) model.status = dto.status;

    await model.save();
    return this.toView(model);
  }

  async remove(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    model.status = ModelStatus.DISABLED;
    await model.save();
    return this.toView(model);
  }

  private async assertProviderInTeam(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<void> {
    const provider = await this.providerModel
      .findOne({ _id: providerId, tenantId, teamId })
      .exec();
    if (!provider) {
      throw new NotFoundException('归属渠道不存在');
    }
  }

  private async assertModelIdAvailable(
    tenantId: string,
    teamId: string,
    modelId: string,
  ): Promise<void> {
    const existing = await this.modelModel
      .findOne({ tenantId, teamId, modelId })
      .exec();
    if (existing) {
      throw new ConflictException('模型标识已存在');
    }
  }

  private async findInTeam(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ModelDocument> {
    const model = await this.modelModel
      .findOne({ _id: id, tenantId, teamId })
      .exec();
    if (!model) {
      throw new NotFoundException('模型不存在');
    }
    return model;
  }

  private toView(model: ModelDocument): ModelView {
    return {
      id: String(model._id),
      providerId: String(model.providerId),
      modelId: model.modelId,
      displayName: model.displayName,
      multiplier: model.multiplier,
      capabilities: model.capabilities,
      aliases: model.aliases,
      status: model.status,
      createdAt: model.createdAt,
    };
  }
}
