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

export interface OfficialFormatPreset {
  type: ProviderType
  baseUrl: string
}

export type PresetCategory = 'official' | 'service-provider'

export interface OfficialProviderPreset {
  key: string
  label: string
  category: PresetCategory
  formats: OfficialFormatPreset[]
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
