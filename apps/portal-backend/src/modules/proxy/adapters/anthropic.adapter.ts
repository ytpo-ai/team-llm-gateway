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

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
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

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function mapToolChoice(choice: unknown): Record<string, unknown> {
  if (typeof choice === 'string') {
    switch (choice) {
      case 'none':
        return { type: 'none' };
      case 'required':
        return { type: 'any' };
      default:
        return { type: 'auto' };
    }
  }
  if (typeof choice === 'object' && choice !== null) {
    const c = choice as Record<string, unknown>;
    if (c.type === 'function') {
      const fn = c.function as Record<string, unknown> | undefined;
      return { type: 'tool', name: asString(fn?.name) };
    }
  }
  return { type: 'auto' };
}

const MEDIA_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function inferMediaType(url: string): string | undefined {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ext ? MEDIA_TYPE_BY_EXT[ext] : undefined;
}

async function convertImageUrl(
  url: string,
): Promise<Record<string, unknown> | undefined> {
  const dataMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(url);
  if (dataMatch) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: dataMatch[1], data: dataMatch[2] },
    };
  }
  if (/^https?:\/\//.test(url)) {
    try {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const buf = await res.arrayBuffer();
      const data = Buffer.from(buf).toString('base64');
      const contentType =
        res.headers.get('content-type')?.split(';')[0].trim() ??
        inferMediaType(url) ??
        'image/png';
      return { type: 'image', source: { type: 'base64', media_type: contentType, data } };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

interface ActiveBlock {
  kind: 'text' | 'tool_use';
  toolIndex: number;
  id: string;
  name: string;
  text: string;
  args: string;
}

class AnthropicStreamTransformer implements StreamTransformer {
  private buffer = '';
  private id = '';
  private model = '';
  private readonly created = Math.floor(Date.now() / 1000);
  private inputTokens = 0;
  private outputTokens = 0;
  private usage: UpstreamUsage | undefined;
  private stopReason: string | null = null;
  private nextToolIndex = 0;
  private blocks = new Map<number, ActiveBlock>();

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
        return this.emit({ role: 'assistant', content: '' }, null);
      }
      case 'content_block_start': {
        const index = Number(obj.index);
        const block = obj.content_block as Record<string, unknown> | undefined;
        if (block?.type === 'tool_use') {
          const id = asString(block.id);
          const name = asString(block.name);
          const toolIndex = this.nextToolIndex++;
          this.blocks.set(index, {
            kind: 'tool_use',
            toolIndex,
            id,
            name,
            text: '',
            args: '',
          });
          return this.emit(
            {
              tool_calls: [
                {
                  index: toolIndex,
                  id,
                  type: 'function',
                  function: { name, arguments: '' },
                },
              ],
            },
            null,
          );
        }
        this.blocks.set(index, {
          kind: 'text',
          toolIndex: -1,
          id: '',
          name: '',
          text: '',
          args: '',
        });
        return '';
      }
      case 'content_block_delta': {
        const index = Number(obj.index);
        const delta = obj.delta as Record<string, unknown> | undefined;
        const block = this.blocks.get(index);
        if (!block) return '';
        if (delta?.type === 'text_delta') {
          const text = asString(delta.text);
          block.text += text;
          return this.emit({ content: text }, null);
        }
        if (delta?.type === 'input_json_delta') {
          const partial = asString(delta.partial_json);
          block.args += partial;
          return this.emit(
            {
              tool_calls: [
                { index: block.toolIndex, function: { arguments: partial } },
              ],
            },
            null,
          );
        }
        return '';
      }
      case 'message_delta': {
        const usage = obj.usage as Record<string, unknown> | undefined;
        const delta = obj.delta as Record<string, unknown> | undefined;
        this.outputTokens = Number(usage?.output_tokens ?? this.outputTokens);
        this.stopReason = asString(delta?.stop_reason);
        this.usage = {
          prompt_tokens: this.inputTokens,
          completion_tokens: this.outputTokens,
          total_tokens: this.inputTokens + this.outputTokens,
        };
        return this.emit({}, mapStopReason(this.stopReason));
      }
      default:
        return '';
    }
  }

  private emit(
    delta: Record<string, unknown>,
    finishReason: string | null,
  ): string {
    const payload: Record<string, unknown> = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    };
    if (this.usage) payload.usage = this.usage;
    return `data: ${JSON.stringify(payload)}\n\n`;
  }
}

export class AnthropicAdapter implements UpstreamAdapter {
  readonly type = ProviderType.ANTHROPIC;

  async buildRequest(input: BuildRequestInput): Promise<AdapterRequest> {
    const body = input.body;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const systemTexts: string[] = [];
    const messages: Array<{
      role: 'user' | 'assistant';
      content: Array<Record<string, unknown>>;
    }> = [];

    for (const raw of rawMessages) {
      const msg = raw as Record<string, unknown>;
      const role = typeof msg.role === 'string' ? msg.role : '';

      if (role === 'system') {
        for (const part of await this.toContentBlocks(msg.content)) {
          if (part.type === 'text') systemTexts.push(asString(part.text));
        }
        continue;
      }

      if (role === 'tool') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: asString(msg.tool_call_id),
              content:
                typeof msg.content === 'string'
                  ? msg.content
                  : JSON.stringify(msg.content ?? ''),
            },
          ],
        });
        continue;
      }

      if (
        role === 'assistant' &&
        Array.isArray(msg.tool_calls) &&
        msg.tool_calls.length > 0
      ) {
        const blocks = await this.toContentBlocks(msg.content);
        for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
          const fn = tc.function as Record<string, unknown> | undefined;
          blocks.push({
            type: 'tool_use',
            id: asString(tc.id),
            name: asString(fn?.name),
            input: safeParseJson(asString(fn?.arguments)),
          });
        }
        messages.push({ role: 'assistant', content: blocks });
        continue;
      }

      messages.push({
        role: mapRole(role),
        content: await this.toContentBlocks(msg.content),
      });
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

    if (Array.isArray(body.tools) && body.tools.length > 0) {
      anthropicBody.tools = (body.tools as Array<Record<string, unknown>>).map(
        (tool) => {
          const fn = tool.function as Record<string, unknown>;
          return {
            name: asString(fn?.name),
            description: asString(fn?.description),
            input_schema:
              (fn?.parameters as Record<string, unknown>) ?? {
                type: 'object',
                properties: {},
              },
          };
        },
      );
      if (body.tool_choice !== undefined) {
        anthropicBody.tool_choice = mapToolChoice(body.tool_choice);
      }
    }

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

    const content = (data.content as AnthropicContentBlock[] | undefined) ?? [];
    let contentText = '';
    const toolCalls: Array<Record<string, unknown>> = [];
    for (const block of content) {
      if (block.type === 'text') {
        contentText += block.text ?? '';
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        });
      }
    }

    const usage = data.usage as Record<string, unknown> | undefined;
    const promptTokens = Number(usage?.input_tokens ?? 0);
    const completionTokens = Number(usage?.output_tokens ?? 0);

    const message: Record<string, unknown> = {
      role: 'assistant',
      content: contentText,
    };
    if (toolCalls.length > 0) message.tool_calls = toolCalls;

    return {
      id: asString(data.id, `chatcmpl-${Date.now()}`),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: asString(data.model, modelId),
      choices: [
        {
          index: 0,
          message,
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

  private async toContentBlocks(
    content: unknown,
  ): Promise<Array<Record<string, unknown>>> {
    const blocks: Array<Record<string, unknown>> = [];
    if (typeof content === 'string') {
      blocks.push({ type: 'text', text: content });
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part !== 'object' || part === null) continue;
        const p = part as Record<string, unknown>;
        if (p.type === 'text') {
          blocks.push({ type: 'text', text: asString(p.text) });
        } else if (p.type === 'image_url') {
          const url = asString(
            (p.image_url as Record<string, unknown> | undefined)?.url,
          );
          const imageBlock = await convertImageUrl(url);
          if (imageBlock) blocks.push(imageBlock);
        }
      }
    }
    return blocks;
  }
}
