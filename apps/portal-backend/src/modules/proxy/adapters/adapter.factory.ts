import { BadRequestException } from '@nestjs/common';
import { ProviderType } from '../../providers/schemas/provider.schema.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { GeminiAdapter } from './gemini.adapter.js';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter.js';
import type { UpstreamAdapter } from './upstream-adapter.js';

const registry: Record<string, UpstreamAdapter> = {
  [ProviderType.OPENAI_COMPATIBLE]: new OpenAICompatibleAdapter(),
  [ProviderType.ANTHROPIC]: new AnthropicAdapter(),
  [ProviderType.GEMINI]: new GeminiAdapter(),
};

export function resolveAdapter(type: ProviderType): UpstreamAdapter {
  const adapter = registry[type];
  if (!adapter) {
    throw new BadRequestException(`不支持的上游协议：${type}`);
  }
  return adapter;
}
