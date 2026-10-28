import { request } from '@/lib/http'
import type {
  ApiKey,
  ApiKeyInput,
  ApiKeyPatch,
  ApiKeyResult,
} from './types'

export function listApiKeys(userId?: string): Promise<ApiKey[]> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return request<ApiKey[]>(`/api-keys${query}`)
}

export function createApiKey(input: ApiKeyInput): Promise<ApiKeyResult> {
  return request<ApiKeyResult>('/api-keys', { method: 'POST', body: input })
}

export function updateApiKey(
  id: string,
  patch: ApiKeyPatch,
): Promise<ApiKey> {
  return request<ApiKey>(`/api-keys/${id}`, { method: 'PATCH', body: patch })
}

export function revokeApiKey(id: string): Promise<ApiKey> {
  return request<ApiKey>(`/api-keys/${id}`, { method: 'DELETE' })
}

export function rotateApiKey(id: string): Promise<ApiKeyResult> {
  return request<ApiKeyResult>(`/api-keys/${id}/rotate`, { method: 'POST' })
}
