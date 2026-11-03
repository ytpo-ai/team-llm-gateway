export type ProviderType = 'openai-compatible' | 'anthropic' | 'gemini'

export type ProviderAuthType = 'api-key' | 'oauth'

export type ProviderStatus = 'active' | 'disabled'

export interface Provider {
  id: string
  name: string
  type: ProviderType
  authType: ProviderAuthType
  baseUrl: string
  apiKeyHint: string
  status: ProviderStatus
  presetKey?: string | null
  createdAt?: string
}

export interface ProviderInput {
  name: string
  type?: ProviderType
  authType?: ProviderAuthType
  baseUrl: string
  apiKey: string
}

export interface ProviderPatch {
  name?: string
  type?: ProviderType
  authType?: ProviderAuthType
  baseUrl?: string
  apiKey?: string
  status?: ProviderStatus
}

export interface ProviderProbeResult {
  ok: boolean
  latencyMs: number
  message: string
}

export interface CreateProviderFromPresetInput {
  presetKey: string
  apiKey: string
  name?: string
}

export interface CreateProviderFromPresetResult {
  provider: Provider
  models: { created: unknown[]; skipped: string[] }
}

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
}

export const PROVIDER_AUTH_TYPE_LABELS: Record<ProviderAuthType, string> = {
  'api-key': 'API Key',
  oauth: 'OAuth 服务账号',
}

export const PROVIDER_TYPE_BASE_URL_HINTS: Record<ProviderType, string> = {
  'openai-compatible': 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
}
