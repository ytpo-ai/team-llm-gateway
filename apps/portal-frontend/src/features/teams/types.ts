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
  email: string
  name: string
  role: Role
  status: MemberStatus
  tenantId: string
  teamId: string | null
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
  team_admin: '团队管理员',
  member: '成员',
  finance: '财务',
  viewer: '只读',
  provider: '服务商',
  system: '系统',
}

export const ASSIGNABLE_ROLES: Role[] = [
  'team_admin',
  'member',
  'finance',
  'viewer',
]
