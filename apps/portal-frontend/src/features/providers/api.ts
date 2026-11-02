import { request } from '@/lib/http'
import type {
  Provider,
  ProviderInput,
  ProviderPatch,
  ProviderProbeResult,
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

export function testProvider(id: string): Promise<ProviderProbeResult> {
  return request<ProviderProbeResult>(`/providers/${id}/test`, {
    method: 'POST',
  })
}
