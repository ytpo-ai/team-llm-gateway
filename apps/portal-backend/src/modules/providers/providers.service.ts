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
import { resolveAdapter } from '../proxy/adapters/adapter.factory.js';
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
  createdAt?: Date;
}

export interface ProviderProbeResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

const PROBE_MODEL: Record<ProviderType, string> = {
  [ProviderType.OPENAI_COMPATIBLE]: 'gpt-4o-mini',
  [ProviderType.ANTHROPIC]: 'claude-3-5-haiku-20241022',
  [ProviderType.GEMINI]: 'gemini-1.5-flash',
};

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
      authType: dto.authType ?? ProviderAuthType.API_KEY,
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
    if (dto.authType !== undefined) provider.authType = dto.authType;
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

  async test(
    tenantId: string,
    teamId: string,
    id: string,
  ): Promise<ProviderProbeResult> {
    const provider = await this.findInTeam(tenantId, teamId, id);

    const upstreamKey = decrypt(
      this.encryptionSecret(),
      provider.apiKeyCiphertext,
    );
    const adapter = resolveAdapter(provider.type);
    const startedAt = Date.now();

    try {
      const request = await adapter.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: upstreamKey,
        modelId: PROBE_MODEL[provider.type] ?? 'gpt-4o-mini',
        body: {
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
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
      return {
        ok,
        latencyMs,
        message: ok
          ? `连通正常（HTTP ${response.status}）`
          : `上游返回 HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: err instanceof Error ? err.message : '连接失败',
      };
    }
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
      authType: provider.authType,
      baseUrl: provider.baseUrl,
      apiKeyHint: provider.apiKeyHint,
      status: provider.status,
      createdAt: provider.createdAt,
    };
  }
}
