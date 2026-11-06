import type { ProviderAuthType, ProviderType } from '../../providers/schemas/provider.schema.js';

export interface UpstreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Snapshot of upstream provider usage/quota, returned by fetchUsage().
 */
export interface ProviderUsageSnapshot {
  quotaTotal: number | null;
  quotaUsed: number | null;
  quotaRemaining: number | null;
  quotaUnit: 'token' | 'request' | 'second' | 'usd' | null;
  rateLimitRemaining: number | null;
  rateLimitReset: Date | null;
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
  authType?: ProviderAuthType;
}

export interface StreamTransformer {
  push(chunk: string): string;
  getUsage(): UpstreamUsage | undefined;
  finish(): string;
}

export interface UpstreamAdapter {
  readonly type: ProviderType;
  buildRequest(input: BuildRequestInput): Promise<AdapterRequest>;
  parseResponse(text: string, modelId: string): Record<string, unknown>;
  createStreamTransformer(): StreamTransformer;
  /**
   * Optional: query upstream provider usage/quota.
   * @param baseUrl - provider base URL
   * @param apiKey - decrypted upstream API key
   * @param usageEndpoint - optional dedicated usage endpoint (overrides default)
   * @returns usage snapshot, or null if not supported
   */
  fetchUsage?(
    baseUrl: string,
    apiKey: string,
    usageEndpoint?: string,
  ): Promise<ProviderUsageSnapshot | null>;
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
