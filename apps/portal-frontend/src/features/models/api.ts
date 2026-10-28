import { request } from '@/lib/http'
import type { Model, ModelInput, ModelPatch } from './types'

export function listModels(): Promise<Model[]> {
  return request<Model[]>('/models')
}

export function createModel(input: ModelInput): Promise<Model> {
  return request<Model>('/models', { method: 'POST', body: input })
}

export function updateModel(id: string, patch: ModelPatch): Promise<Model> {
  return request<Model>(`/models/${id}`, { method: 'PATCH', body: patch })
}

export function removeModel(id: string): Promise<Model> {
  return request<Model>(`/models/${id}`, { method: 'DELETE' })
}
