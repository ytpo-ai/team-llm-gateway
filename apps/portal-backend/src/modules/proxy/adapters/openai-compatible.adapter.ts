import { ProviderType } from '../../providers/schemas/provider.schema.js';
import {
  parseJsonObject,
  trimTrailingSlash,
  type AdapterRequest,
  type BuildRequestInput,
  type StreamTransformer,
  type UpstreamAdapter,
  type UpstreamUsage,
} from './upstream-adapter.js';

class OpenAICompatibleStreamTransformer implements StreamTransformer {
  private buffer = '';
  private usage: UpstreamUsage | undefined;

  push(chunk: string): string {
    this.buffer = `${this.buffer}${chunk}`.slice(-8192);
    this.usage = this.extractUsage(this.buffer) ?? this.usage;
    return chunk;
  }

  getUsage(): UpstreamUsage | undefined {
    return this.usage;
  }

  finish(): string {
    return '';
  }

  private extractUsage(buffer: string): UpstreamUsage | undefined {
    for (const line of buffer.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      const obj = parseJsonObject(payload);
      if (obj?.usage) return obj.usage as UpstreamUsage;
    }
    return undefined;
  }
}

export class OpenAICompatibleAdapter implements UpstreamAdapter {
  readonly type = ProviderType.OPENAI_COMPATIBLE;

  buildRequest(input: BuildRequestInput): AdapterRequest {
    const upstreamBody: Record<string, unknown> = {
      ...input.body,
      model: input.modelId,
    };
    if (input.stream) {
      upstreamBody.stream_options = {
        ...(input.body.stream_options as Record<string, unknown> | null | undefined),
        include_usage: true,
      };
    }
    return {
      url: `${trimTrailingSlash(input.baseUrl)}/chat/completions`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    };
  }

  parseResponse(text: string): Record<string, unknown> {
    return parseJsonObject(text) ?? { message: text };
  }

  createStreamTransformer(): StreamTransformer {
    return new OpenAICompatibleStreamTransformer();
  }
}
