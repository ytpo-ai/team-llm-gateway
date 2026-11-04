import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { ApiKey, ApiKeyStatus } from '../../api-keys/schemas/api-key.schema.js';
import type { ApiKeyContext } from '../decorators/api-key-context.decorator.js';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const xApiKey = request.headers['x-api-key'];

    let key = '';
    if (authorization?.startsWith('Bearer ')) {
      key = authorization.slice('Bearer '.length).trim();
    } else if (typeof xApiKey === 'string' && xApiKey.trim()) {
      key = xApiKey.trim();
    }

    if (!key) {
      throw new UnauthorizedException('缺少 API Key');
    }

    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.apiKeyModel.findOne({ keyHash }).exec();

    if (!apiKey || apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new UnauthorizedException('API Key 无效或已吊销');
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('API Key 已过期');
    }

    const apiKeyContext: ApiKeyContext = {
      tenantId: String(apiKey.tenantId),
      teamId: String(apiKey.teamId),
      userId: String(apiKey.userId),
      apiKeyId: String(apiKey._id),
      apiKey,
    };
    (request as Request & { apiKeyContext?: ApiKeyContext }).apiKeyContext =
      apiKeyContext;

    return true;
  }
}
