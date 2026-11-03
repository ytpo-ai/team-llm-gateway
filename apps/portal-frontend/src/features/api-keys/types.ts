export type ApiKeyStatus = 'active' | 'revoked'

export interface ApiKey {
  id: string
  name: string | null
  keyPrefix: string
  status: ApiKeyStatus
  expiresAt: string | null
  policySetId: string | null
  lastUsedAt: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  createdAt?: string
}

export interface ApiKeyResult {
  apiKey: ApiKey
  key: string
}

export interface ApiKeyInput {
  userId?: string
  name?: string
  expiresAt?: string
  policySetId?: string
}

export interface ApiKeyPatch {
  userId?: string
  name?: string | null
  expiresAt?: string | null
  policySetId?: string | null
}
