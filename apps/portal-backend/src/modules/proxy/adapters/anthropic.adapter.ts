import { ProviderType } from '../../providers/schemas/provider.schema.js';
import {
  asString,
  parseJsonObject,
  splitSseEvents,
  trimTrailingSlash,
  type AdapterRequest,
  type BuildRequestInput,
  type StreamTransformer,
  type UpstreamAdapter,
  type UpstreamUsage,
} from './upstream-adapter.js';

const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

function toTextParts(content: unknown): Array<{ type: 'text'; text: string }> {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is Record<string, unknown> =>
          typeof part === 'object' && part !== null && part.type === 'text',
      )
      .map((part) => ({ type: 'text' as const, text: asString(part.text) }));
  }
  return [{ type: 'text', text: asString(content) }];
}

function mapRole(role: string): 'user' | 'assistant' {
  return role === 'assistant' ? 'assistant' : 'user';
}

function mapStopReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return 'stop';
  }
}

class AnthropicStreamTransformer implements StreamTransformer {
  private buffer = '';
  private id = '';
  private model = '';
  private readonly created = Math.floor(Date.now() / 1000);
  private inputTokens = 0;
  private outputTokens = 0;
  private usage: UpstreamUsage | undefined;

  push(chunk: string): string {
    this.buffer += chunk;
    const { complete, remainder } = splitSseEvents(this.buffer);
    this.buffer = remainder;
    let out = '';
    for (const event of complete) {
      out += this.handleEvent(event);
    }
    return out;
  }

  getUsage(): UpstreamUsage | undefined {
    return this.usage;
  }

  finish(): string {
    let out = '';
    if (this.buffer.trim()) {
      out += this.handleEvent(this.buffer);
    }
    this.buffer = '';
    return out.endsWith('data: [DONE]\n\n') ? out : `${out}data: [DONE]\n\n`;
  }

  private handleEvent(raw: string): string {
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        dataLines.push(trimmed.slice(5).trim());
      }
    }
    if (dataLines.length === 0) return '';
    const obj = parseJsonObject(dataLines.join('\n'));
    if (!obj) return '';

    switch (obj.type) {
      case 'message_start': {
        const message = obj.message as Record<string, unknown> | undefined;
        const usage = message?.usage as Record<string, unknown> | undefined;
        this.id = asString(message?.id);
        this.model = asString(message?.model);
        this.inputTokens = Number(usage?.input_tokens ?? 0);
        return this.chunk({ role: 'assistant', content: '' }, null);
      }
      case 'content_block_delta': {
        const delta = obj.delta as Record<string, unknown> | undefined;
        const text = asString(delta?.text);
        return this.chunk({ content: text }, null);
      }
      case 'message_delta': {
        const usage = obj.usage as Record<string, unknown> | undefined;
        const delta = obj.delta as Record<string, unknown> | undefined;
        this.outputTokens = Number(usage?.output_tokens ?? this.outputTokens);
        this.usage = {
          prompt_tokens: this.inputTokens,
          completion_tokens: this.outputTokens,
          total_tokens: this.inputTokens + this.outputTokens,
        };
        const finishReason = mapStopReason(asString(delta?.stop_reason));
        return this.chunk({}, finishReason);
      }
      default:
        return '';
    }
  }

  private chunk(
    delta: Record<string, unknown>,
    finishReason: string | null,
  ): string {
    const payload: Record<string, unknown> = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        { index: 0, delta, finish_reason: finishReason },
      ],
    };
    if (this.usage) payload.usage = this.usage;
    return `data: ${JSON.stringify(payload)}\n\n`;
  }
}

export class AnthropicAdapter implements UpstreamAdapter {
  readonly type = ProviderType.ANTHROPIC;

  buildRequest(input: BuildRequestInput): AdapterRequest {
    const body = input.body;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const systemTexts: string[] = [];
    const messages: Array<{
      role: 'user' | 'assistant';
      content: Array<{ type: 'text'; text: string }>;
    }> = [];

    for (const raw of rawMessages) {
      const msg = raw as { role?: unknown; content?: unknown };
      const role = typeof msg.role === 'string' ? msg.role : '';
      const parts = toTextParts(msg.content);
      if (role === 'system') {
        for (const part of parts) systemTexts.push(part.text);
      } else {
        messages.push({ role: mapRole(role), content: parts });
      }
    }

    const maxTokens =
      typeof body.max_tokens === 'number'
        ? body.max_tokens
        : typeof body.max_completion_tokens === 'number'
          ? body.max_completion_tokens
          : DEFAULT_MAX_TOKENS;

    const anthropicBody: Record<string, unknown> = {
      model: input.modelId,
      max_tokens: maxTokens,
      messages,
    };
    if (systemTexts.length > 0) anthropicBody.system = systemTexts.join('\n\n');
    if (typeof body.temperature === 'number') {
      anthropicBody.temperature = body.temperature;
    }
    if (typeof body.top_p === 'number') anthropicBody.top_p = body.top_p;
    if (Array.isArray(body.stop)) anthropicBody.stop_sequences = body.stop;
    if (input.stream) anthropicBody.stream = true;

    return {
      url: `${trimTrailingSlash(input.baseUrl)}/v1/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    };
  }

  parseResponse(text: string, modelId: string): Record<string, unknown> {
    const data = parseJsonObject(text);
    if (!data) return { message: text };

    const content = (data.content as AnthropicTextBlock[] | undefined) ?? [];
    const contentText = content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const usage = data.usage as Record<string, unknown> | undefined;
    const promptTokens = Number(usage?.input_tokens ?? 0);
    const completionTokens = Number(usage?.output_tokens ?? 0);

    return {
      id: asString(data.id, `chatcmpl-${Date.now()}`),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: asString(data.model, modelId),
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: contentText },
          finish_reason: mapStopReason(asString(data.stop_reason)),
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  }

  createStreamTransformer(): StreamTransformer {
    return new AnthropicStreamTransformer();
  }
}
