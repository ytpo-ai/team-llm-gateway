export interface RoleTemplate {
  id: string
  name: string
  description: string
  policySetId: string | null
  builtIn: boolean
  createdAt?: string
}

export interface CreateRoleTemplateInput {
  name: string
  description?: string
  policySetId?: string
}

export interface UpdateRoleTemplateInput {
  name?: string
  description?: string
  policySetId?: string | null
}
