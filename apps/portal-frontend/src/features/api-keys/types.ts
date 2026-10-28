export type ApiKeyStatus = 'active' | 'revoked'

export interface ApiKey {
  id: string
  name: string | null
  keyPrefix: string
  status: ApiKeyStatus
  expiresAt: string | null
  allowedModels: string[]
  rateLimitPerMinute: number | null
  maxTokens: number | null
  lastUsedAt: string | null
  userId: string
  createdAt?: string
}

export interface ApiKeyResult {
  apiKey: ApiKey
  key: string
}

export interface ApiKeyInput {
  name?: string
  expiresAt?: string
  allowedModels?: string[]
  rateLimitPerMinute?: number
  maxTokens?: number
}

export interface ApiKeyPatch {
  name?: string | null
  expiresAt?: string | null
  allowedModels?: string[]
  rateLimitPerMinute?: number | null
  maxTokens?: number | null
}
