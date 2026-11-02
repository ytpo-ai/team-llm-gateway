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

function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && part.type === 'text'
          ? asString((part as { text?: unknown }).text)
          : '',
      )
      .join('');
  }
  return asString(content);
}

function mapRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

function mapFinishReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'stop';
  }
}

class GeminiStreamTransformer implements StreamTransformer {
  private buffer = '';
  private model = '';
  private readonly created = Math.floor(Date.now() / 1000);
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

    const candidates = obj.candidates as Array<Record<string, unknown>> | undefined;
    const candidate = candidates?.[0];
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const text = (parts ?? []).map((part) => asString(part.text)).join('');

    const metadata = obj.usageMetadata as Record<string, unknown> | undefined;
    if (metadata) {
      const promptTokens = Number(metadata.promptTokenCount ?? 0);
      const completionTokens = Number(metadata.candidatesTokenCount ?? 0);
      this.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens:
          Number(metadata.totalTokenCount ?? promptTokens + completionTokens),
      };
    }

    const finishReason = candidate?.finishReason
      ? mapFinishReason(asString(candidate.finishReason))
      : null;

    const payload: Record<string, unknown> = {
      id: `chatcmpl-${this.created}`,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        { index: 0, delta: { content: text }, finish_reason: finishReason },
      ],
    };
    if (this.usage) payload.usage = this.usage;
    return `data: ${JSON.stringify(payload)}\n\n`;
  }
}

export class GeminiAdapter implements UpstreamAdapter {
  readonly type = ProviderType.GEMINI;

  buildRequest(input: BuildRequestInput): AdapterRequest {
    const body = input.body;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    const systemTexts: string[] = [];

    for (const raw of rawMessages) {
      const msg = raw as { role?: unknown; content?: unknown };
      const role = typeof msg.role === 'string' ? msg.role : '';
      const text = toText(msg.content);
      if (role === 'system') {
        systemTexts.push(text);
      } else {
        contents.push({ role: mapRole(role), parts: [{ text }] });
      }
    }

    const generationConfig: Record<string, unknown> = {};
    if (typeof body.max_tokens === 'number') {
      generationConfig.maxOutputTokens = body.max_tokens;
    } else if (typeof body.max_completion_tokens === 'number') {
      generationConfig.maxOutputTokens = body.max_completion_tokens;
    }
    if (typeof body.temperature === 'number') {
      generationConfig.temperature = body.temperature;
    }
    if (typeof body.top_p === 'number') generationConfig.topP = body.top_p;

    const geminiBody: Record<string, unknown> = { contents };
    if (systemTexts.length > 0) {
      geminiBody.systemInstruction = {
        parts: systemTexts.map((text) => ({ text })),
      };
    }
    if (Object.keys(generationConfig).length > 0) {
      geminiBody.generationConfig = generationConfig;
    }

    const endpoint = input.stream ? 'streamGenerateContent' : 'generateContent';
    const query = input.stream ? '?alt=sse' : '';
    const url = `${trimTrailingSlash(input.baseUrl)}/v1beta/models/${encodeURIComponent(input.modelId)}:${endpoint}${query}`;

    return {
      url,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify(geminiBody),
    };
  }

  parseResponse(text: string, modelId: string): Record<string, unknown> {
    const data = parseJsonObject(text);
    if (!data) return { message: text };

    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    const candidate = candidates?.[0];
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const contentText = (parts ?? [])
      .map((part) => asString(part.text))
      .join('');

    const metadata = data.usageMetadata as Record<string, unknown> | undefined;
    const promptTokens = Number(metadata?.promptTokenCount ?? 0);
    const completionTokens = Number(metadata?.candidatesTokenCount ?? 0);
    const totalTokens = Number(
      metadata?.totalTokenCount ?? promptTokens + completionTokens,
    );

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: contentText },
          finish_reason: mapFinishReason(
            candidate?.finishReason ? asString(candidate.finishReason) : null,
          ),
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };
  }

  createStreamTransformer(): StreamTransformer {
    return new GeminiStreamTransformer();
  }
}
