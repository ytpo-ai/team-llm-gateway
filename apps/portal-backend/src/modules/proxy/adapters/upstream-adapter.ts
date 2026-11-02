import type { ProviderType } from '../../providers/schemas/provider.schema.js';

export interface UpstreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface AdapterRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface BuildRequestInput {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  body: Record<string, unknown>;
  stream: boolean;
}

export interface StreamTransformer {
  push(chunk: string): string;
  getUsage(): UpstreamUsage | undefined;
  finish(): string;
}

export interface UpstreamAdapter {
  readonly type: ProviderType;
  buildRequest(input: BuildRequestInput): AdapterRequest;
  parseResponse(text: string, modelId: string): Record<string, unknown>;
  createStreamTransformer(): StreamTransformer;
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function splitSseEvents(
  buffer: string,
): { complete: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const complete: string[] = [];
  let index = 0;
  for (;;) {
    const separator = normalized.indexOf('\n\n', index);
    if (separator === -1) break;
    const event = normalized.slice(index, separator);
    if (event.trim()) complete.push(event);
    index = separator + 2;
  }
  return { complete, remainder: normalized.slice(index) };
}

export function parseJsonObject(
  payload: string,
): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(payload) as unknown;
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}
