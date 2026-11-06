import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider } from '../providers/schemas/provider.schema.js';
import { BulkCreateModelDto } from './dto/bulk-create-model.dto.js';
import { CreateModelDto } from './dto/create-model.dto.js';
import { UpdateModelDto } from './dto/update-model.dto.js';
import {
  OFFICIAL_PRESETS,
  SERVICE_PROVIDER_PRESETS,
  type OfficialProviderPreset,
} from './official-presets.js';
import {
  Model as ModelEntity,
  ModelDocument,
  ModelStatus,
} from './schemas/model.schema.js';

export interface ProviderBindingView {
  providerId: string;
  providerName: string;
  priority: number;
}

export interface ModelView {
  id: string;
  providerId: string;
  providerBindings: ProviderBindingView[];
  modelId: string;
  displayName: string;
  description: string;
  contextLength: number | null;
  maxOutputLength: number | null;
  inputModalities: string[];
  outputModalities: string[];
  multiplier: number;
  capabilities: string[];
  aliases: string[];
  status: ModelStatus;
  createdAt?: Date;
}

export interface BulkCreateResult {
  created: ModelView[];
  skipped: string[];
}

const PRESETS_TTL_MS = 60 * 60 * 1000;

/**
 * Merge raw bindings from the document with resolved provider info.
 * Always includes primary providerId + extra providerBindings.
 */
async function resolveBindings(
  model: ModelDocument,
  providerModel: Model<Provider>,
): Promise<ProviderBindingView[]> {
  const rawBindings = model.providerBindings ?? [];

  // Collect all unique provider IDs (primary + extras)
  const allProviderIds: Types.ObjectId[] = [];
  if (model.providerId) {
    allProviderIds.push(model.providerId);
  }
  for (const b of rawBindings) {
    if (!allProviderIds.some((id) => String(id) === String(b.providerId))) {
      allProviderIds.push(b.providerId);
    }
  }

  if (allProviderIds.length === 0) return [];

  // Batch resolve provider info
  const providers = await providerModel
    .find({ _id: { $in: allProviderIds } })
    .select('name defaultPriority')
    .exec();
  const nameMap = new Map(providers.map((p) => [String(p._id), p.name]));
  const priorityMap = new Map(providers.map((p) => [String(p._id), p.defaultPriority ?? 0]));

  const result: ProviderBindingView[] = [];

  // Primary provider (always first, uses its defaultPriority or 0)
  if (model.providerId) {
    result.push({
      providerId: String(model.providerId),
      providerName: nameMap.get(String(model.providerId)) ?? '未知渠道',
      priority: priorityMap.get(String(model.providerId)) ?? 0,
    });
  }

  // Extra bindings from providerBindings (exclude primary to avoid dupes)
  for (const b of rawBindings) {
    if (String(b.providerId) === String(model.providerId)) continue;
    result.push({
      providerId: String(b.providerId),
      providerName: nameMap.get(String(b.providerId)) ?? '未知渠道',
      priority: b.priority,
    });
  }

  return result;
}

@Injectable()
export class ModelsService {
  private presetsCache: {
    presets: OfficialProviderPreset[];
    fetchedAt: number;
  } | null = null;

  constructor(
    @InjectModel(ModelEntity.name)
    private readonly modelModel: Model<ModelEntity>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    private readonly configService: ConfigService,
  ) {}

  async getOfficialPresets(): Promise<OfficialProviderPreset[]> {
    const remoteUrl = this.configService.get<string>('modelPresets.url');
    if (!remoteUrl) return [...OFFICIAL_PRESETS, ...SERVICE_PROVIDER_PRESETS];

    const now = Date.now();
    if (this.presetsCache && now - this.presetsCache.fetchedAt < PRESETS_TTL_MS) {
      return this.presetsCache.presets;
    }

    try {
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const presets = (await res.json()) as OfficialProviderPreset[];
      this.presetsCache = { presets, fetchedAt: now };
      return presets;
    } catch {
      return [...OFFICIAL_PRESETS, ...SERVICE_PROVIDER_PRESETS];
    }
  }

  async list(tenantId: string, teamId: string): Promise<ModelView[]> {
    const models = await this.modelModel
      .find({ tenantId, teamId })
      .sort({ createdAt: -1 })
      .exec();

    const views: ModelView[] = [];
    for (const model of models) {
      views.push(await this.toView(model, true));
    }
    return views;
  }

  async get(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    return this.toView(model, true);
  }

  async create(
    tenantId: string,
    teamId: string,
    dto: CreateModelDto,
  ): Promise<ModelView> {
    await this.assertProviderInTeam(tenantId, teamId, dto.providerId);

    // Validate all additional bindings' providers
    if (dto.providerBindings) {
      for (const binding of dto.providerBindings) {
        if (binding.providerId === dto.providerId) continue;
        await this.assertProviderInTeam(tenantId, teamId, binding.providerId);
      }
    }

    await this.assertModelIdAvailable(tenantId, teamId, dto.modelId);

    const rawBindings = (dto.providerBindings ?? []).map((b) => ({
      providerId: new Types.ObjectId(b.providerId),
      priority: b.priority,
    }));

    const model = await this.modelModel.create({
      tenantId,
      teamId,
      providerId: dto.providerId,
      providerBindings: rawBindings,
      modelId: dto.modelId,
      displayName: dto.displayName ?? '',
      description: dto.description ?? '',
      contextLength: dto.contextLength ?? null,
      maxOutputLength: dto.maxOutputLength ?? null,
      inputModalities: dto.inputModalities ?? ['text'],
      outputModalities: dto.outputModalities ?? ['text'],
      multiplier: dto.multiplier ?? 1,
      capabilities: dto.capabilities ?? [],
      aliases: dto.aliases ?? [],
      status: ModelStatus.ACTIVE,
    });

    return this.toView(model, true);
  }

  async bulkCreate(
    tenantId: string,
    teamId: string,
    dto: BulkCreateModelDto,
  ): Promise<BulkCreateResult> {
    await this.assertProviderInTeam(tenantId, teamId, dto.providerId);

    const created: ModelView[] = [];
    const skipped: string[] = [];

    for (const item of dto.models) {
      const existing = await this.modelModel
        .findOne({ tenantId, teamId, modelId: item.modelId })
        .exec();
      if (existing) {
        skipped.push(item.modelId);
        continue;
      }

      const model = await this.modelModel.create({
        tenantId,
        teamId,
        providerId: dto.providerId,
        modelId: item.modelId,
        displayName: item.displayName ?? '',
        description: item.description ?? '',
        contextLength: item.contextLength ?? null,
        maxOutputLength: item.maxOutputLength ?? null,
        inputModalities: item.inputModalities ?? ['text'],
        outputModalities: item.outputModalities ?? ['text'],
        multiplier: item.multiplier ?? 1,
        capabilities: item.capabilities ?? [],
        aliases: item.aliases ?? [],
        status: ModelStatus.ACTIVE,
        providerBindings: [],
      });
      created.push(await this.toView(model, true));
    }

    return { created, skipped };
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
    if (dto.providerBindings !== undefined) {
      // Validate all bindings' providers
      for (const binding of dto.providerBindings) {
        await this.assertProviderInTeam(tenantId, teamId, binding.providerId);
      }
      model.providerBindings = dto.providerBindings.map((b) => ({
        providerId: new Types.ObjectId(b.providerId),
        priority: b.priority,
      }));
    }
    if (dto.modelId !== undefined && dto.modelId !== model.modelId) {
      await this.assertModelIdAvailable(tenantId, teamId, dto.modelId);
      model.modelId = dto.modelId;
    }
    if (dto.displayName !== undefined) model.displayName = dto.displayName;
    if (dto.description !== undefined) model.description = dto.description;
    if (dto.contextLength !== undefined) model.contextLength = dto.contextLength;
    if (dto.maxOutputLength !== undefined)
      model.maxOutputLength = dto.maxOutputLength;
    if (dto.inputModalities !== undefined)
      model.inputModalities = dto.inputModalities;
    if (dto.outputModalities !== undefined)
      model.outputModalities = dto.outputModalities;
    if (dto.multiplier !== undefined) model.multiplier = dto.multiplier;
    if (dto.capabilities !== undefined) model.capabilities = dto.capabilities;
    if (dto.aliases !== undefined) model.aliases = dto.aliases;
    if (dto.status !== undefined) model.status = dto.status;

    await model.save();
    return this.toView(model, true);
  }

  async disable(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    model.status = ModelStatus.DISABLED;
    await model.save();
    return this.toView(model, true);
  }

  async enable(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    model.status = ModelStatus.ACTIVE;
    await model.save();
    return this.toView(model, true);
  }

  async remove(tenantId: string, teamId: string, id: string): Promise<ModelView> {
    const model = await this.findInTeam(tenantId, teamId, id);
    const view = await this.toView(model, false);
    await this.modelModel.deleteOne({ _id: model._id }).exec();
    return view;
  }

  /**
   * Remove a provider from all model bindings.
   * If a model has no remaining bindings and its primary providerId matches,
   * disable the model. Returns count of models disabled.
   */
  async removeProviderBinding(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<number> {
    const providerOid = new Types.ObjectId(providerId);

    // Find all models that have this provider in their bindings or as primary
    const models = await this.modelModel
      .find({
        tenantId,
        teamId,
        $or: [
          { providerId: providerOid },
          { 'providerBindings.providerId': providerOid },
        ],
      })
      .exec();

    let disabledCount = 0;

    for (const model of models) {
      // Remove the provider from bindings
      if (model.providerBindings && model.providerBindings.length > 0) {
        model.providerBindings = model.providerBindings.filter(
          (b) => String(b.providerId) !== providerId,
        );
      }

      // If this was the primary provider, switch to the highest-priority remaining binding
      if (String(model.providerId) === providerId) {
        if (model.providerBindings && model.providerBindings.length > 0) {
          const sorted = [...model.providerBindings].sort(
            (a, b) => a.priority - b.priority,
          );
          model.providerId = sorted[0].providerId;
          model.providerBindings = model.providerBindings.filter(
            (b) => String(b.providerId) !== String(sorted[0].providerId),
          );
        } else {
          // No remaining bindings — disable the model
          model.status = ModelStatus.DISABLED;
          disabledCount++;
        }
      }

      await model.save();
    }

    return disabledCount;
  }

  async disableByProvider(
    _tenantId: string,
    _teamId: string,
    _providerId: string,
  ): Promise<number> {
    // With multi-channel, disabling a provider does NOT cascade to models.
    // Models may still be accessible through other channels.
    // Returning 0 for backward compatibility.
    return 0;
  }

  async enableByProvider(
    _tenantId: string,
    _teamId: string,
    _providerId: string,
  ): Promise<number> {
    // With multi-channel, enabling a provider does not cascade to models.
    // Returning 0 for backward compatibility.
    return 0;
  }

  async deleteByProvider(
    tenantId: string,
    teamId: string,
    providerId: string,
  ): Promise<number> {
    // Delegate to removeProviderBinding for multi-channel aware cascade
    return this.removeProviderBinding(tenantId, teamId, providerId);
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

  private async toView(
    model: ModelDocument,
    resolveBindingNames: boolean,
  ): Promise<ModelView> {
    let providerBindings: ProviderBindingView[];

    if (resolveBindingNames) {
      providerBindings = await resolveBindings(model, this.providerModel);
    } else {
      providerBindings = [];
    }

    return {
      id: String(model._id),
      providerId: String(model.providerId),
      providerBindings,
      modelId: model.modelId,
      displayName: model.displayName,
      description: model.description,
      contextLength: model.contextLength ?? null,
      maxOutputLength: model.maxOutputLength ?? null,
      inputModalities: model.inputModalities ?? ['text'],
      outputModalities: model.outputModalities ?? ['text'],
      multiplier: model.multiplier,
      capabilities: model.capabilities,
      aliases: model.aliases,
      status: model.status,
      createdAt: model.createdAt,
    };
  }
}