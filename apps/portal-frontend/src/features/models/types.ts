import type { ProviderType } from '@/features/providers/types'

export type ModelStatus = 'active' | 'disabled'

export interface Model {
  id: string
  providerId: string
  modelId: string
  displayName: string
  multiplier: number
  capabilities: string[]
  aliases: string[]
  status: ModelStatus
  createdAt?: string
}

export interface OfficialModelPreset {
  modelId: string
  displayName: string
  capabilities: string[]
  multiplier: number
}

export interface OfficialProviderPreset {
  key: string
  type: ProviderType
  label: string
  baseUrl: string
  models: OfficialModelPreset[]
}

export interface ModelInput {
  providerId: string
  modelId: string
  displayName?: string
  multiplier?: number
  capabilities?: string[]
  aliases?: string[]
}

export interface ModelPatch {
  providerId?: string
  modelId?: string
  displayName?: string
  multiplier?: number
  capabilities?: string[]
  aliases?: string[]
  status?: ModelStatus
}
