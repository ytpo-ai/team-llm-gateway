import type { Role } from '@/features/auth/types'

export type TeamStatus = 'active' | 'suspended'

export interface Team {
  id: string
  name: string
  status: TeamStatus
  tenantId: string
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

export type InvitationStatus = 'pending' | 'accepted' | 'revoked'

export interface Invitation {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  expiresAt: string
  createdAt?: string
}

export interface InvitationResult {
  invitation: Invitation
  token: string
}

export const ROLE_LABELS: Record<Role, string> = {
  system: '系统管理员',
  team_admin: '团队管理员',
  member: '成员',
}

export const ASSIGNABLE_ROLES: Role[] = ['team_admin', 'member']
