export type ProviderType = 'openai-compatible' | 'anthropic'

export type ProviderStatus = 'active' | 'disabled'

export interface Provider {
  id: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKeyHint: string
  status: ProviderStatus
  createdAt?: string
}

export interface ProviderInput {
  name: string
  type?: ProviderType
  baseUrl: string
  apiKey: string
}

export interface ProviderPatch {
  name?: string
  type?: ProviderType
  baseUrl?: string
  apiKey?: string
  status?: ProviderStatus
}

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
}
