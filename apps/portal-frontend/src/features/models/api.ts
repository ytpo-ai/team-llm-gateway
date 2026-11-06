import { request } from '@/lib/http'
import type {
  Model,
  ModelInput,
  ModelPatch,
  OfficialProviderPreset,
} from './types'

export interface BulkModelItem {
  modelId: string
  displayName?: string
  description?: string
  contextLength?: number | null
  maxOutputLength?: number | null
  inputModalities?: string[]
  outputModalities?: string[]
  multiplier?: number
  capabilities?: string[]
  aliases?: string[]
}

export interface BulkCreateModelsInput {
  providerId: string
  models: BulkModelItem[]
}

export interface BulkCreateModelsResult {
  created: Model[]
  skipped: string[]
}

export function listModels(): Promise<Model[]> {
  return request<Model[]>('/models')
}

export function listOfficialPresets(): Promise<OfficialProviderPreset[]> {
  return request<OfficialProviderPreset[]>('/models/presets')
}

export function createModel(input: ModelInput): Promise<Model> {
  return request<Model>('/models', { method: 'POST', body: input })
}

export function bulkCreateModels(
  input: BulkCreateModelsInput,
): Promise<BulkCreateModelsResult> {
  return request<BulkCreateModelsResult>('/models/bulk', {
    method: 'POST',
    body: input,
  })
}

export function updateModel(id: string, patch: ModelPatch): Promise<Model> {
  return request<Model>(`/models/${id}`, { method: 'PATCH', body: patch })
}

export function disableModel(id: string): Promise<Model> {
  return request<Model>(`/models/${id}/disable`, { method: 'POST' })
}

export function enableModel(id: string): Promise<Model> {
  return request<Model>(`/models/${id}/enable`, { method: 'POST' })
}

export function deleteModel(id: string): Promise<Model> {
  return request<Model>(`/models/${id}`, { method: 'DELETE' })
}
