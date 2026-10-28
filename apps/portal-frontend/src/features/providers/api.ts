import { request } from '@/lib/http'
import type {
  Provider,
  ProviderInput,
  ProviderPatch,
} from './types'

export function listProviders(): Promise<Provider[]> {
  return request<Provider[]>('/providers')
}

export function createProvider(input: ProviderInput): Promise<Provider> {
  return request<Provider>('/providers', { method: 'POST', body: input })
}

export function updateProvider(
  id: string,
  patch: ProviderPatch,
): Promise<Provider> {
  return request<Provider>(`/providers/${id}`, { method: 'PATCH', body: patch })
}

export function removeProvider(id: string): Promise<Provider> {
  return request<Provider>(`/providers/${id}`, { method: 'DELETE' })
}
