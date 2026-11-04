import {
  asString,
  parseJsonObject,
  splitSseEvents,
  type StreamTransformer,
  type UpstreamUsage,
} from './upstream-adapter.js';

const DEFAULT_MAX_TOKENS = 4096;

// ---------- 请求翻译：Anthropic Messages -> OpenAI Chat ----------

function imageSourceToUrl(source: unknown): string {
  const s = source as Record<string, unknown> | undefined;
  if (!s) return '';
  if (s.type === 'base64') {
    return `data:${asString(s.media_type, 'image/png')};base64,${asString(s.data)}`;
  }
  if (s.type === 'url') {
    return asString(s.url);
  }
  return '';
}

function mapAnthropicToolChoice(choice: unknown): unknown {
  if (typeof choice === 'string') {
    return choice === 'any' ? 'required' : choice;
  }
  if (typeof choice === 'object' && choice !== null) {
    const c = choice as Record<string, unknown>;
    switch (c.type) {
      case 'auto':
        return 'auto';
      case 'any':
        return 'required';
      case 'none':
        return 'none';
      case 'tool':
        return { type: 'function', function: { name: asString(c.name) } };
      default:
        return 'auto';
    }
  }
  return 'auto';
}

export function anthropicToOpenAI(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  const system = body.system;
  if (typeof system === 'string' && system.length > 0) {
    messages.push({ role: 'system', content: system });
  } else if (Array.isArray(system)) {
    const text = (system as Array<Record<string, unknown>>)
      .filter((block) => block.type === 'text')
      .map((block) => asString(block.text))
      .join('\n');
    if (text) messages.push({ role: 'system', content: text });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  for (const raw of rawMessages) {
    const msg = raw as Record<string, unknown>;
    const role = asString(msg.role);
    const content = msg.content;

    if (role === 'assistant') {
      const textParts: string[] = [];
      const toolCalls: Array<Record<string, unknown>> = [];
      if (Array.isArray(content)) {
        for (const block of content as Array<Record<string, unknown>>) {
          if (block.type === 'text') textParts.push(asString(block.text));
          else if (block.type === 'tool_use') {
            toolCalls.push({
              id: asString(block.id),
              type: 'function',
              function: {
                name: asString(block.name),
                arguments: JSON.stringify(block.input ?? {}),
              },
            });
          }
        }
      }
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: textParts.join(''),
      };
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      messages.push(assistantMsg);
      continue;
    }

    if (role === 'user') {
      if (Array.isArray(content)) {
        const blocks = content as Array<Record<string, unknown>>;
        const toolResults = blocks.filter((b) => b.type === 'tool_result');
        if (toolResults.length > 0) {
          for (const tr of toolResults) {
            messages.push({
              role: 'tool',
              tool_call_id: asString(tr.tool_use_id),
              content:
                typeof tr.content === 'string'
                  ? tr.content
                  : JSON.stringify(tr.content ?? ''),
            });
          }
          continue;
        }

        const texts: string[] = [];
        const imageParts: Array<Record<string, unknown>> = [];
        for (const block of blocks) {
          if (block.type === 'text') texts.push(asString(block.text));
          else if (block.type === 'image') {
            const url = imageSourceToUrl(block.source);
            if (url) imageParts.push({ type: 'image_url', image_url: { url } });
          }
        }
        const text = texts.join('');
        if (imageParts.length === 0) {
          messages.push({ role: 'user', content: text });
        } else {
          const parts: Array<Record<string, unknown>> = [];
          if (text) parts.push({ type: 'text', text });
          parts.push(...imageParts);
          messages.push({ role: 'user', content: parts });
        }
        continue;
      }
      messages.push({
        role: 'user',
        content: typeof content === 'string' ? content : '',
      });
    }
  }

  const openaiBody: Record<string, unknown> = {
    model: body.model,
    messages,
    max_tokens:
      typeof body.max_tokens === 'number' ? body.max_tokens : DEFAULT_MAX_TOKENS,
  };
  if (typeof body.temperature === 'number') {
    openaiBody.temperature = body.temperature;
  }
  if (typeof body.top_p === 'number') openaiBody.top_p = body.top_p;
  if (Array.isArray(body.stop_sequences)) openaiBody.stop = body.stop_sequences;
  if (typeof body.stream === 'boolean') openaiBody.stream = body.stream;

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    openaiBody.tools = (body.tools as Array<Record<string, unknown>>).map(
      (tool) => ({
        type: 'function',
        function: {
          name: asString(tool.name),
          description: asString(tool.description),
          parameters:
            (tool.input_schema as Record<string, unknown>) ?? {
              type: 'object',
              properties: {},
            },
        },
      }),
    );
    if (body.tool_choice !== undefined) {
      openaiBody.tool_choice = mapAnthropicToolChoice(body.tool_choice);
    }
  }

  return openaiBody;
}

// ---------- 响应翻译：OpenAI Chat -> Anthropic Messages ----------

function mapStopReasonToAnthropic(reason: string): string {
  switch (reason) {
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

export function openAIToAnthropic(
  openaiJson: Record<string, unknown>,
  modelId: string,
): Record<string, unknown> {
  const choices = Array.isArray(openaiJson.choices) ? openaiJson.choices : [];
  const first = (choices[0] as Record<string, unknown> | undefined) ?? {};
  const message = (first.message as Record<string, unknown> | undefined) ?? {};

  const content: Array<Record<string, unknown>> = [];
  const text = asString(message.content);
  if (text) content.push({ type: 'text', text });

  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const tc of toolCalls as Array<Record<string, unknown>>) {
    const fn = tc.function as Record<string, unknown> | undefined;
    let input: unknown = {};
    try {
      input = JSON.parse(asString(fn?.arguments, '{}'));
    } catch {
      input = {};
    }
    content.push({
      type: 'tool_use',
      id: asString(tc.id, `toolu_${Date.now()}`),
      name: asString(fn?.name),
      input,
    });
  }

  const usage = openaiJson.usage as Record<string, unknown> | undefined;
  const inputTokens = Number(usage?.prompt_tokens ?? 0);
  const outputTokens = Number(usage?.completion_tokens ?? 0);

  return {
    id: asString(openaiJson.id, `msg_${Date.now()}`),
    type: 'message',
    role: 'assistant',
    model: asString(openaiJson.model, modelId),
    content,
    stop_reason: mapStopReasonToAnthropic(asString(first.finish_reason)),
    stop_sequence: null,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

export function anthropicError(message: string): Record<string, unknown> {
  return { type: 'error', error: { type: 'api_error', message } };
}

// ---------- 流式翻译：OpenAI SSE -> Anthropic SSE ----------

interface ActiveBlock {
  index: number;
  type: 'text' | 'tool_use';
}

export class OpenAIAnthropicStreamTransformer implements StreamTransformer {
  private buffer = '';
  private id = '';
  private model = '';
  private started = false;
  private activeBlock: ActiveBlock | null = null;
  private nextBlockIndex = 0;
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
    if (this.started) {
      if (this.activeBlock) {
        out += this.emit('content_block_stop', { index: this.activeBlock.index });
        this.activeBlock = null;
      }
      out += this.emit('message_stop', undefined);
      this.started = false;
    }
    return out;
  }

  private handleEvent(raw: string): string {
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) dataLines.push(trimmed.slice(5).trim());
    }
    if (dataLines.length === 0) return '';
    if (dataLines.every((l) => l === '' || l === '[DONE]')) return '';
    const obj = parseJsonObject(dataLines.join('\n'));
    if (!obj) return '';

    this.id = asString(obj.id, this.id);
    this.model = asString(obj.model, this.model);
    const usageObj = obj.usage as Record<string, unknown> | undefined;
    if (usageObj) {
      this.inputTokens = Number(usageObj.prompt_tokens ?? this.inputTokens);
      this.outputTokens = Number(
        usageObj.completion_tokens ?? this.outputTokens,
      );
      this.usage = {
        prompt_tokens: this.inputTokens,
        completion_tokens: this.outputTokens,
        total_tokens: this.inputTokens + this.outputTokens,
      };
    }

    const choices = Array.isArray(obj.choices) ? obj.choices : [];
    const first = (choices[0] as Record<string, unknown> | undefined) ?? {};
    const delta = (first.delta as Record<string, unknown> | undefined) ?? {};
    const finishReason = first.finish_reason;

    let out = '';
    if (!this.started) {
      this.started = true;
      out += this.emit('message_start', {
        message: {
          id: this.id,
          type: 'message',
          role: 'assistant',
          model: this.model,
          content: [],
          usage: { input_tokens: this.inputTokens, output_tokens: 0 },
        },
      });
    }

    const textDelta = delta.content;
    if (typeof textDelta === 'string' && textDelta.length > 0) {
      if (!this.activeBlock || this.activeBlock.type !== 'text') {
        if (this.activeBlock) {
          out += this.emit('content_block_stop', { index: this.activeBlock.index });
        }
        this.activeBlock = { index: this.nextBlockIndex++, type: 'text' };
        out += this.emit('content_block_start', {
          index: this.activeBlock.index,
          content_block: { type: 'text', text: '' },
        });
      }
      out += this.emit('content_block_delta', {
        index: this.activeBlock.index,
        delta: { type: 'text_delta', text: textDelta },
      });
    }

    const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const tc of toolCalls as Array<Record<string, unknown>>) {
      const fn = tc.function as Record<string, unknown> | undefined;
      const name = asString(fn?.name);
      const args = asString(fn?.arguments);
      if (name) {
        if (this.activeBlock) {
          out += this.emit('content_block_stop', { index: this.activeBlock.index });
        }
        this.activeBlock = { index: this.nextBlockIndex++, type: 'tool_use' };
        out += this.emit('content_block_start', {
          index: this.activeBlock.index,
          content_block: {
            type: 'tool_use',
            id: asString(tc.id),
            name,
            input: {},
          },
        });
      }
      if (args) {
        if (this.activeBlock && this.activeBlock.type === 'tool_use') {
          out += this.emit('content_block_delta', {
            index: this.activeBlock.index,
            delta: { type: 'input_json_delta', partial_json: args },
          });
        }
      }
    }

    if (finishReason) {
      if (this.activeBlock) {
        out += this.emit('content_block_stop', { index: this.activeBlock.index });
        this.activeBlock = null;
      }
      out += this.emit('message_delta', {
        delta: {
          stop_reason: mapStopReasonToAnthropic(asString(finishReason)),
          stop_sequence: null,
        },
        usage: { output_tokens: this.outputTokens },
      });
      out += this.emit('message_stop', undefined);
      this.started = false;
    }

    return out;
  }

  private emit(type: string, data: Record<string, unknown> | undefined): string {
    const payload = data === undefined ? { type } : { type, ...data };
    return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  }
}
