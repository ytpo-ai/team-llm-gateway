import { request } from '@/lib/http'
import type {
  CreateProviderFromPresetInput,
  CreateProviderFromPresetResult,
  Provider,
  ProviderInput,
  ProviderPatch,
  ProviderProbeResult,
  ProviderUsageView,
} from './types'
import type { BulkCreateModelsResult } from '@/features/models/api'

export function listProviders(): Promise<Provider[]> {
  return request<Provider[]>('/providers')
}

export function createProvider(input: ProviderInput): Promise<Provider> {
  return request<Provider>('/providers', { method: 'POST', body: input })
}

export function createProviderFromPreset(
  input: CreateProviderFromPresetInput,
): Promise<CreateProviderFromPresetResult> {
  return request<CreateProviderFromPresetResult>('/providers/from-preset', {
    method: 'POST',
    body: input,
  })
}

export function updateProvider(
  id: string,
  patch: ProviderPatch,
): Promise<Provider> {
  return request<Provider>(`/providers/${id}`, { method: 'PATCH', body: patch })
}

export function disableProvider(id: string): Promise<Provider> {
  return request<Provider>(`/providers/${id}/disable`, { method: 'POST' })
}

export function enableProvider(id: string): Promise<Provider> {
  return request<Provider>(`/providers/${id}/enable`, { method: 'POST' })
}

export function deleteProvider(id: string): Promise<Provider> {
  return request<Provider>(`/providers/${id}`, { method: 'DELETE' })
}

export interface TestProviderInput {
  modelId?: string
  message?: string
}

export function testProvider(
  id: string,
  body?: TestProviderInput,
): Promise<ProviderProbeResult> {
  return request<ProviderProbeResult>(`/providers/${id}/test`, {
    method: 'POST',
    body,
  })
}

export function syncProviderModels(
  id: string,
): Promise<BulkCreateModelsResult> {
  return request<BulkCreateModelsResult>(
    `/providers/${id}/sync-models`,
    { method: 'POST' },
  )
}

export interface BatchTestInput {
  modelIds: string[]
  message?: string
}

export interface BatchTestResult {
  results: ProviderProbeResult[]
}

export function batchTestProvider(
  id: string,
  body: BatchTestInput,
): Promise<BatchTestResult> {
  return request<BatchTestResult>(`/providers/${id}/batch-test`, {
    method: 'POST',
    body,
  })
}

export function getProviderUsages(): Promise<ProviderUsageView[]> {
  return request<ProviderUsageView[]>('/usage/providers')
}

export function fetchProviderUsage(
  id: string,
): Promise<ProviderUsageView> {
  return request<ProviderUsageView>(`/providers/${id}/fetch-usage`, {
    method: 'POST',
  })
}
