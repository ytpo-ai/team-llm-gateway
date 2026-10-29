import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { ApiKeyContextParam } from './decorators/api-key-context.decorator.js';
import type { ApiKeyContext } from './decorators/api-key-context.decorator.js';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard.js';
import { ProxyService } from './proxy.service.js';

@ApiTags('v1')
@UseGuards(ApiKeyAuthGuard)
@Controller('v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('models')
  @ApiOperation({ summary: '列出团队可用模型（OpenAI 兼容）' })
  listModels(@ApiKeyContextParam() ctx: ApiKeyContext) {
    return this.proxyService.listModels(ctx);
  }

  @Post('chat/completions')
  @ApiOperation({ summary: 'OpenAI 兼容 chat 转发（支持 SSE 流式）' })
  async chatCompletions(
    @ApiKeyContextParam() ctx: ApiKeyContext,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    if (body.stream) {
      await this.proxyService.streamChatCompletions(ctx, body, res);
      return undefined;
    }
    return this.proxyService.chatCompletions(ctx, body, res);
  }
}
