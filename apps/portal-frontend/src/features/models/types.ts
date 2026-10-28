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
