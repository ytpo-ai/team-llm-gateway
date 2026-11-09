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
  defaultPriority: number
  createdAt?: string
}

export interface ProviderInput {
  name: string
  type?: ProviderType
  authType?: ProviderAuthType
  baseUrl: string
  apiKey: string
  defaultPriority?: number
}

export interface ProviderPatch {
  name?: string
  type?: ProviderType
  authType?: ProviderAuthType
  baseUrl?: string
  apiKey?: string
  status?: ProviderStatus
  presetKey?: string
  defaultPriority?: number
}

export interface ProviderProbeResult {
  ok: boolean
  latencyMs: number
  message: string
  reply?: string
  modelId?: string
}

export interface CreateProviderFromPresetInput {
  presetKey: string
  apiKey: string
  name?: string
  format?: ProviderType
  baseUrl?: string
  defaultPriority?: number
}

/** 创建预置渠道后仅返回渠道信息，模型需通过导入流程单独导入 */
export type CreateProviderFromPresetResult = Provider

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

export interface ProviderUsageView {
  providerId: string
  providerName: string
  rateLimitRemaining: number | null
  rateLimitReset: string | null
  exhaustedUntil: string | null
  cooldownUntil: string | null
  consecutiveFailures: number
  errorMessage: string | null
  lastStatus: string
  fetchedAt: string
}
