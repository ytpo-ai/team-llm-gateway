import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange(v as Role)}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'team_admin' || user?.role === 'system'

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [limitsOpen, setLimitsOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

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
      setLimitsOpen(false)
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
    onSuccess: () => {
      invalidate()
      setRemoveTarget(null)
    },
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

  const openInvite = () => {
    setInviteEmail('')
    setInviteRole('member')
    setInviteLink(null)
    setInviteError(null)
    setInviteOpen(true)
  }

  const handleInvite = (e: FormEvent) => {
    e.preventDefault()
    setInviteLink(null)
    inviteMutation.mutate()
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
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLimitsOpen(true)}>
              团队使用限额
            </Button>
            <Button onClick={openInvite}>邀请成员</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>成员</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin && invitations.length > 0 && (
            <div className="mb-4 space-y-2">
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
                        <Select
                          value={member.roleTemplateId ?? ''}
                          onValueChange={(v) =>
                            updateMemberMutation.mutate({
                              userId: member.id,
                              patch: {
                                roleTemplateId: v || null,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">未分配</SelectItem>
                            {roleTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                            onClick={() => setRemoveTarget(member)}
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
            <DialogDescription>
              生成邀请链接并发送给成员，对方凭链接注册后即加入团队
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleInvite}>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                成员邮箱
              </label>
              <Input
                type="email"
                placeholder="成员邮箱"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                成员角色
              </label>
              <RoleSelect
                value={inviteRole}
                onChange={(role) => setInviteRole(role)}
              />
            </div>

            {inviteError && (
              <p className="text-sm text-red-500">{inviteError}</p>
            )}

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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? '生成中…' : '生成邀请链接'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>团队使用限额</DialogTitle>
            <DialogDescription>
              设置团队级日/周/月 token 上限，与成员角色、API Key 限额取最严格生效
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLimitsOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={() => updateTeamMutation.mutate()}
                disabled={updateTeamMutation.isPending}
              >
                {updateTeamMutation.isPending ? '保存中…' : '保存限额'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将「{removeTarget?.name}」移出团队吗？移除后该成员将失去团队访问权限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMemberMutation.isPending}
              onClick={() =>
                removeTarget && removeMemberMutation.mutate(removeTarget.id)
              }
            >
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
