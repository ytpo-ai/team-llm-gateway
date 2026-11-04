import type { Role } from '@/features/auth/types'

export type TeamStatus = 'active' | 'suspended'

export interface Team {
  id: string
  name: string
  status: TeamStatus
  tenantId: string
  policySetId: string | null
}

export type MemberStatus = 'active' | 'disabled'

export interface Member {
  id: string
  email: string | null
  name: string
  role: Role
  status: MemberStatus
  tenantId: string
  teamId: string | null
  roleTemplateId: string | null
}

export const ROLE_LABELS: Record<Role, string> = {
  system: '系统管理员',
  team_admin: '团队管理员',
  member: '成员',
}

export const ASSIGNABLE_ROLES: Role[] = ['team_admin', 'member']
