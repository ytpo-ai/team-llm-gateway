import { request } from '@/lib/http'
import type {
  CreateRoleTemplateInput,
  RoleTemplate,
  UpdateRoleTemplateInput,
} from './types'

export function listRoleTemplates(): Promise<RoleTemplate[]> {
  return request<RoleTemplate[]>('/role-templates')
}

export function createRoleTemplate(
  input: CreateRoleTemplateInput,
): Promise<RoleTemplate> {
  return request<RoleTemplate>('/role-templates', {
    method: 'POST',
    body: input,
  })
}

export function updateRoleTemplate(
  id: string,
  patch: UpdateRoleTemplateInput,
): Promise<RoleTemplate> {
  return request<RoleTemplate>(`/role-templates/${id}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function removeRoleTemplate(id: string): Promise<RoleTemplate> {
  return request<RoleTemplate>(`/role-templates/${id}`, {
    method: 'DELETE',
  })
}
