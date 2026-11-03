import type { Role } from '@/features/auth/types'
import { request } from '@/lib/http'
import type {
  Invitation,
  InvitationResult,
  Member,
  MemberStatus,
  Team,
} from './types'

export function listTeams(): Promise<Team[]> {
  return request<Team[]>('/teams')
}

export function createTeam(name: string): Promise<Team> {
  return request<Team>('/teams', { method: 'POST', body: { name } })
}

export function updateTeam(
  teamId: string,
  patch: {
    name?: string
    policySetId?: string | null
  },
): Promise<Team> {
  return request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: patch })
}

export function listMembers(teamId: string): Promise<Member[]> {
  return request<Member[]>(`/teams/${teamId}/members`)
}

export function updateMember(
  teamId: string,
  userId: string,
  patch: { role?: Role; status?: MemberStatus; roleTemplateId?: string | null },
): Promise<Member> {
  return request<Member>(`/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function removeMember(teamId: string, userId: string): Promise<Member> {
  return request<Member>(`/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function createInvitation(
  teamId: string,
  email: string,
  role: Role,
): Promise<InvitationResult> {
  return request<InvitationResult>(`/teams/${teamId}/invitations`, {
    method: 'POST',
    body: { email, role },
  })
}

export function listInvitations(teamId: string): Promise<Invitation[]> {
  return request<Invitation[]>(`/teams/${teamId}/invitations`)
}

export function revokeInvitation(
  teamId: string,
  invitationId: string,
): Promise<Invitation> {
  return request<Invitation>(
    `/teams/${teamId}/invitations/${invitationId}`,
    { method: 'DELETE' },
  )
}
