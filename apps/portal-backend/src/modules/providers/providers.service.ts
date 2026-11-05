import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  buildApiKeyHint,
  decrypt,
  encrypt,
} from '../../common/crypto/cipher.js';
import { BulkCreateResult } from '../models/models.service.js';
import { ModelsService } from '../models/models.service.js';
import { resolveAdapter } from '../proxy/adapters/adapter.factory.js';
import { CreateProviderFromPresetDto } from './dto/create-provider-from-preset.dto.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import {
  Provider,
  ProviderAuthType,
  ProviderDocument,
  ProviderStatus,
  ProviderType,
} from './schemas/provider.schema.js';

export interface ProviderView {
  id: string;
  name: string;
  type: ProviderType;
  authType: ProviderAuthType;
  baseUrl: string;
  apiKeyHint: string;
  status: ProviderStatus;
  presetKey?: string | null;
  createdAt?: Date;
}

export interface ProviderProbeResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  reply?: string;
  modelId?: string;
}

export interface CreateFromPresetResult {
  provider: ProviderView;
  models: BulkCreateResult;
}

const PROBE_MODEL: Record<ProviderType, string> = {
  [ProviderType.OPENAI_COMPATIBLE]: 'gpt-4o-mini',
  [ProviderType.ANTHROPIC]: 'claude-3-5-haiku-20241022',
  [ProviderType.GEMINI]: 'gemini-1.5-flash',
};

/**
 * Extract the model's text reply from a raw response body.
 * Returns `undefined` on any parse failure so the caller falls back gracefully.
 */
function extractReply(
  body: unknown,
  providerType: ProviderType,
): string | undefined {
  try {
    if (providerType === ProviderType.OPENAI_COMPATIBLE) {
      const b = body as Record<string, unknown>;
      const choices = b?.choices as Array<Record<string, unknown>> | undefined;
      const content = choices?.[0]?.message as Record<string, unknown> | undefined;
      return typeof content?.content === 'string' ? content.content : undefined;
    }

    if (providerType === ProviderType.ANTHROPIC) {
      const b = body as Record<string, unknown>;
      const content = b?.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content) && content.length > 0) {
        const texts = content
          .filter((c) => c?.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text as string);
        if (texts.length > 0) return texts.join('\n');
      }
      return undefined;
    }

    if (providerType === ProviderType.GEMINI) {
      const b = body as Record<string, unknown>;
      const candidates = b?.candidates as Array<Record<string, unknown>> | undefined;
      const parts = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const partList = parts?.parts as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(partList) && partList.length > 0) {
        const texts = partList
          .filter((p) => typeof p.text === 'string')
          .map((p) => p.text as string);
        if (texts.length > 0) return texts.join('\n');
      }
      return undefined;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly configService: ConfigService,
    private readonly modelsService: ModelsService,
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
      authType: dto.authType ?? ProviderAuthType.API_KEY,
      baseUrl: dto.baseUrl,
      apiKeyCiphertext: encrypt(secret, dto.apiKey),
      apiKeyHint: buildApiKeyHint(dto.apiKey),
      status: ProviderStatus.ACTIVE,
      presetKey: dto.presetKey,
    });

    return this.toView(provider);
  }

  async createFromPreset(
    tenantId: string,
    teamId: string,
    dto: CreateProviderFromPresetDto,
  ): Promise<CreateFromPresetResult> {
    const presets = await this.modelsService.getOfficialPresets();
    const preset = presets.find((p) => p.key === dto.presetKey);
    if (!preset) {
      throw new NotFoundException('官方渠道预置不存在');
    }

    const format =
      preset.formats.find((f) => f.type === dto.format) ?? preset.formats[0];
    if (!format) {
      throw new NotFoundException('官方渠道预置未配置可用格式');
    }

    const provider = await this.create(tenantId, teamId, {
      name: dto.name?.trim() || preset.label,
      type: format.type,
      authType: ProviderAuthType.API_KEY,
      baseUrl: dto.baseUrl?.trim() || format.baseUrl,
      apiKey: dto.apiKey,
      presetKey: preset.key,
    });

    const models = await this.modelsService.bulkCreate(tenantId, teamId, {
      providerId: provider.id,
      models: preset.models.map((model) => ({
        modelId: model.modelId,
        displayName: model.displayName,
        multiplier: model.multiplier,
        capabilities: model.capabilities,
        aliases: [],
      })),
    });

    return { provider, models };
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
    if (dto.authType !== undefined) provider.authType = dto.authType;
    if (dto.baseUrl !== undefined) provider.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined) {
      const secret = this.encryptionSecret();
      provider.apiKeyCiphertext = encrypt(secret, dto.apiKey);
      provider.apiKeyHint = buildApiKeyHint(dto.apiKey);
    }
    if (dto.status !== undefined) provider.status = dto.status;
    if (dto.presetKey !== undefined) provider.presetKey = dto.presetKey || undefined;

    await provider.save();
    return this.toView(provider);
  }

  async disable(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);
    provider.status = ProviderStatus.DISABLED;
    await provider.save();
    // Multi-channel: disabling a provider does not cascade to models
    // Models may still be accessible through other channels
    return this.toView(provider);
  }

  async enable(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);
    provider.status = ProviderStatus.ACTIVE;
    await provider.save();
    // Multi-channel: enabling a provider does not cascade to models
    return this.toView(provider);
  }

  async remove(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderView> {
    const provider = await this.findInTeam(tenantId, teamId, id);
    // Multi-channel: remove the provider from all model bindings
    // Models with no remaining bindings will be disabled
    await this.modelsService.removeProviderBinding(
      tenantId,
      teamId,
      String(provider._id),
    );
    await this.providerModel.deleteOne({ _id: provider._id }).exec();
    return this.toView(provider);
  }

  async syncPresetModels(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<BulkCreateResult> {
    const provider = await this.findInTeam(tenantId, teamId, id);

    if (!provider.presetKey) {
      return { created: [], skipped: [] };
    }

    const presets = await this.modelsService.getOfficialPresets();
    const preset = presets.find((p) => p.key === provider.presetKey);
    if (!preset || !preset.models.length) {
      return { created: [], skipped: [] };
    }

    return this.modelsService.bulkCreate(tenantId, teamId, {
      providerId: String(provider._id),
      models: preset.models.map((model) => ({
        modelId: model.modelId,
        displayName: model.displayName,
        multiplier: model.multiplier,
        capabilities: model.capabilities,
        aliases: [],
      })),
    });
  }

  async test(
    tenantId: string,
    teamId: string,
    id: string,
    modelId?: string,
    message?: string,
  ): Promise<ProviderProbeResult> {
    const provider = await this.findInTeam(tenantId, teamId, id);

    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const adapter = resolveAdapter(provider.type);
    const startedAt = Date.now();
    const resolvedModelId =
      modelId ||
      (await this.resolveProbeModelId(
        tenantId,
        teamId,
        String(provider._id),
        provider.type,
        provider.presetKey,
      ));
    const testMessage = message || 'ping';

    try {
      const request = await adapter.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: upstreamKey,
        modelId: resolvedModelId,
        body: {
          messages: [{ role: 'user', content: testMessage }],
          max_tokens: message ? 1024 : 1,
        },
        stream: false,
        authType: provider.authType,
      });

      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });

      const latencyMs = Date.now() - startedAt;
      if (response.status === 401 || response.status === 403) {
        return { ok: false, latencyMs, message: '鉴权失败，请检查上游 key' };
      }
      const ok = response.status >= 200 && response.status < 300;

      let reply: string | undefined;
      if (ok) {
        try {
          const body = await response.json();
          reply = extractReply(body, provider.type);
        } catch {
          // non-JSON or parse error — ignore, reply stays undefined
        }
      }

      return {
        ok,
        latencyMs,
        message: ok
          ? `连通正常（HTTP ${response.status}）`
          : `上游返回 HTTP ${response.status}`,
        reply,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: err instanceof Error ? err.message : '连接失败',
      };
    }
  }

  async batchTest(
    tenantId: string,
    teamId: string,
    id: string,
    modelIds: string[],
    message?: string,
  ): Promise<{ results: ProviderProbeResult[] }> {
    const provider = await this.findInTeam(tenantId, teamId, id);

    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const adapter = resolveAdapter(provider.type);
    const testMessage = message || 'ping';

    const results: ProviderProbeResult[] = [];

    for (const modelId of modelIds) {
      const startedAt = Date.now();
      try {
        const request = await adapter.buildRequest({
          baseUrl: provider.baseUrl,
          apiKey: upstreamKey,
          modelId,
          body: {
            messages: [{ role: 'user', content: testMessage }],
            max_tokens: message ? 1024 : 1,
          },
          stream: false,
          authType: provider.authType,
        });

        const response = await fetch(request.url, {
          method: 'POST',
          headers: request.headers,
          body: request.body,
        });

        const latencyMs = Date.now() - startedAt;
        if (response.status === 401 || response.status === 403) {
          results.push({
            modelId,
            ok: false,
            latencyMs,
            message: '鉴权失败，请检查上游 key',
          });
          continue;
        }
        const ok = response.status >= 200 && response.status < 300;

        let reply: string | undefined;
        if (ok) {
          try {
            const body = await response.json();
            reply = extractReply(body, provider.type);
          } catch {
            // ignore parse error
          }
        }

        results.push({
          modelId,
          ok,
          latencyMs,
          message: ok
            ? `连通正常（HTTP ${response.status}）`
            : `上游返回 HTTP ${response.status}`,
          reply,
        });
      } catch (err) {
        results.push({
          modelId,
          ok: false,
          latencyMs: Date.now() - startedAt,
          message: err instanceof Error ? err.message : '连接失败',
        });
      }
    }

    return { results };
  }

  private encryptionSecret(): string {
    return this.configService.getOrThrow<string>('encryption.secret');
  }

  private async resolveProbeModelId(
    tenantId: string,
    teamId: string,
    providerId: string,
    type: ProviderType,
    presetKey?: string,
  ): Promise<string> {
    const models = await this.modelsService.list(tenantId, teamId);

    // 1. Try active model
    const activeModel = models.find(
      (m) => m.providerId === providerId && m.status === 'active',
    );
    if (activeModel) return activeModel.modelId;

    // 2. Try any model (even disabled)
    const anyModel = models.find((m) => m.providerId === providerId);
    if (anyModel) return anyModel.modelId;

    // 3. Try preset models via presetKey
    if (presetKey) {
      const presets = await this.modelsService.getOfficialPresets();
      const preset = presets.find((p) => p.key === presetKey);
      if (preset?.models.length) return preset.models[0].modelId;
    }

    // 4. Last resort: hardcoded defaults
    return PROBE_MODEL[type] ?? 'gpt-4o-mini';
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
      authType: provider.authType,
      baseUrl: provider.baseUrl,
      apiKeyHint: provider.apiKeyHint,
      status: provider.status,
      presetKey: provider.presetKey ?? null,
      createdAt: provider.createdAt,
    };
  }
}
