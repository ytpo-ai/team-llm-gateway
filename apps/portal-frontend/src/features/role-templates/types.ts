export interface RoleTemplate {
  id: string
  name: string
  description: string
  limitDaily: number | null
  limitWeekly: number | null
  limitMonthly: number | null
  rateLimitPerMinute: number | null
  providerIds: string[]
  modelWhitelist: string[]
  builtIn: boolean
  createdAt?: string
}

export interface CreateRoleTemplateInput {
  name: string
  description?: string
  limitDaily?: number
  limitWeekly?: number
  limitMonthly?: number
  rateLimitPerMinute?: number
  providerIds?: string[]
  modelWhitelist?: string[]
}

export type UpdateRoleTemplateInput = Partial<CreateRoleTemplateInput>
