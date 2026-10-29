import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ApiKey } from '../../api-keys/schemas/api-key.schema.js';

export interface ApiKeyContext {
  tenantId: string;
  teamId: string;
  userId: string;
  apiKeyId: string;
  apiKey: ApiKey;
}

export const ApiKeyContextParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as Request & { apiKeyContext: ApiKeyContext })
      .apiKeyContext;
  },
);
