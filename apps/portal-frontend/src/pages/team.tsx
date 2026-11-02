import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/store'
import type { Role } from '@/features/auth/types'
import { listRoleTemplates } from '@/features/role-templates/api'
import type { RoleTemplate } from '@/features/role-templates/types'
import {
  createInvitation,
  listInvitations,
  listMembers,
  listTeams,
  removeMember,
  revokeInvitation,
  updateMember,
  updateTeam,
} from '@/features/teams/api'
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type Invitation,
  type Member,
} from '@/features/teams/types'
import { ApiError } from '@/lib/http'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: Role
  disabled?: boolean
  onChange: (role: Role) => void
}) {
  return (
    <select
      className={selectClass}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
    >
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  )
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const team = teamsQuery.data?.[0]

  const membersQuery = useQuery({
    queryKey: ['members', team?.id],
    queryFn: () => listMembers(team!.id),
    enabled: !!team,
  })

  const invitationsQuery = useQuery({
    queryKey: ['invitations', team?.id],
    queryFn: () => listInvitations(team!.id),
    enabled: !!team && isAdmin,
  })

  const roleTemplatesQuery = useQuery({
    queryKey: ['role-templates'],
    queryFn: listRoleTemplates,
    enabled: isAdmin,
  })

  const [teamLimits, setTeamLimits] = useState({
    limitDaily: '',
    limitWeekly: '',
    limitMonthly: '',
  })

  useEffect(() => {
    if (team) {
      setTeamLimits({
        limitDaily: team.limitDaily != null ? String(team.limitDaily) : '',
        limitWeekly: team.limitWeekly != null ? String(team.limitWeekly) : '',
        limitMonthly: team.limitMonthly != null ? String(team.limitMonthly) : '',
      })
    }
  }, [team?.id, team?.limitDaily, team?.limitWeekly, team?.limitMonthly])

  const updateTeamMutation = useMutation({
    mutationFn: () =>
      updateTeam(team!.id, {
        limitDaily: teamLimits.limitDaily
          ? Number(teamLimits.limitDaily)
          : null,
        limitWeekly: teamLimits.limitWeekly
          ? Number(teamLimits.limitWeekly)
          : null,
        limitMonthly: teamLimits.limitMonthly
          ? Number(teamLimits.limitMonthly)
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['members', team?.id] })

  const updateMemberMutation = useMutation({
    mutationFn: (args: {
      userId: string
      patch: { role?: Role; roleTemplateId?: string | null }
    }) => updateMember(team!.id, args.userId, args.patch),
    onSuccess: invalidate,
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeMember(team!.id, userId),
    onSuccess: invalidate,
  })

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitation(team!.id, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['invitations', team?.id] }),
  })

  const inviteMutation = useMutation({
    mutationFn: () => createInvitation(team!.id, inviteEmail, inviteRole),
    onSuccess: (data) => {
      setInviteLink(`${window.location.origin}/invite?token=${data.token}`)
      setInviteError(null)
      queryClient.invalidateQueries({ queryKey: ['invitations', team?.id] })
    },
    onError: (err) => {
      setInviteError(
        err instanceof ApiError ? err.message : '操作失败，请稍后重试',
      )
    },
  })

  const handleInvite = (e: FormEvent) => {
    e.preventDefault()
    setInviteLink(null)
    setInviting(true)
    inviteMutation.mutate(undefined, { onSettled: () => setInviting(false) })
  }

  const copyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
    }
  }

  if (teamsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">加载中…</div>
  }

  if (!team) {
    return (
      <div className="text-sm text-muted-foreground">
        尚未初始化团队，请先完成注册。
      </div>
    )
  }

  const members: Member[] = membersQuery.data ?? []
  const invitations: Invitation[] = invitationsQuery.data ?? []
  const roleTemplates: RoleTemplate[] = roleTemplatesQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            共 {members.length} 名成员
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>邀请成员</CardTitle>
            <CardDescription>
              生成邀请链接并发送给成员，对方凭链接注册后即加入团队
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-3" onSubmit={handleInvite}>
              <div className="flex-1 min-w-56">
                <Input
                  type="email"
                  placeholder="成员邮箱"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <RoleSelect
                value={inviteRole}
                onChange={(role) => setInviteRole(role)}
              />
              <Button type="submit" disabled={inviting || inviteMutation.isPending}>
                {inviting || inviteMutation.isPending ? '生成中…' : '生成邀请链接'}
              </Button>
            </form>

            {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}

            {inviteLink && (
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 p-2">
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {inviteLink}
                </span>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  复制
                </Button>
              </div>
            )}

            {invitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">已发出的邀请</p>
                <ul className="space-y-1">
                  {invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
                    >
                      <span>
                        {invitation.email}
                        <span className="ml-2 text-muted-foreground">
                          {ROLE_LABELS[invitation.role]} ·{' '}
                          {invitation.status === 'pending'
                            ? '待接受'
                            : invitation.status === 'accepted'
                              ? '已加入'
                              : '已撤销'}
                        </span>
                      </span>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            revokeInvitationMutation.mutate(invitation.id)
                          }
                        >
                          撤销
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>团队使用限额</CardTitle>
            <CardDescription>
              设置团队级日/周/月 token 上限，与成员角色、API Key 限额取最严格生效
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  日 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  value={teamLimits.limitDaily}
                  onChange={(e) =>
                    setTeamLimits({ ...teamLimits, limitDaily: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  周 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  value={teamLimits.limitWeekly}
                  onChange={(e) =>
                    setTeamLimits({ ...teamLimits, limitWeekly: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  月 token 上限（留空不限）
                </label>
                <Input
                  type="number"
                  min={1}
                  value={teamLimits.limitMonthly}
                  onChange={(e) =>
                    setTeamLimits({ ...teamLimits, limitMonthly: e.target.value })
                  }
                />
              </div>
            </div>
            <Button
              onClick={() => updateTeamMutation.mutate()}
              disabled={updateTeamMutation.isPending}
            >
              {updateTeamMutation.isPending ? '保存中…' : '保存限额'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>成员</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">姓名</th>
                  <th className="py-2 pr-4 font-medium">邮箱</th>
                  <th className="py-2 pr-4 font-medium">管理角色</th>
                  <th className="py-2 pr-4 font-medium">使用角色</th>
                  <th className="py-2 pr-4 font-medium">状态</th>
                  {isAdmin && <th className="py-2 font-medium">操作</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{member.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {member.email ?? '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {isAdmin && member.id !== user?.id ? (
                        <RoleSelect
                          value={member.role}
                          onChange={(role) =>
                            updateMemberMutation.mutate({
                              userId: member.id,
                              patch: { role },
                            })
                          }
                        />
                      ) : (
                        <span>{ROLE_LABELS[member.role]}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isAdmin ? (
                        <select
                          className={selectClass}
                          value={member.roleTemplateId ?? ''}
                          onChange={(e) =>
                            updateMemberMutation.mutate({
                              userId: member.id,
                              patch: {
                                roleTemplateId: e.target.value || null,
                              },
                            })
                          }
                        >
                          <option value="">未分配</option>
                          {roleTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {roleTemplates.find(
                            (t) => t.id === member.roleTemplateId,
                          )?.name ?? '未分配'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {member.status === 'active' ? '正常' : '已禁用'}
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        {member.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMemberMutation.mutate(member.id)}
                          >
                            移除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
