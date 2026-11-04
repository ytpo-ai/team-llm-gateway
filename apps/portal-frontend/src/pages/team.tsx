import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
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
import { listPolicySets } from '@/features/policy-sets/api'
import type { PolicySet } from '@/features/policy-sets/types'
import { listRoleTemplates } from '@/features/role-templates/api'
import type { RoleTemplate } from '@/features/role-templates/types'
import {
  createMember,
  listMembers,
  listTeams,
  removeMember,
  updateMember,
  updateTeam,
} from '@/features/teams/api'
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
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

  const [addOpen, setAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<Role>('member')
  const [addError, setAddError] = useState<string | null>(null)

  const [limitsOpen, setLimitsOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const team = teamsQuery.data?.[0]

  const membersQuery = useQuery({
    queryKey: ['members', team?.id],
    queryFn: () => listMembers(team!.id),
    enabled: !!team,
  })

  const roleTemplatesQuery = useQuery({
    queryKey: ['role-templates'],
    queryFn: listRoleTemplates,
    enabled: isAdmin,
  })

  const policySetsQuery = useQuery({
    queryKey: ['policy-sets'],
    queryFn: listPolicySets,
    enabled: isAdmin,
  })

  const [teamPolicySetId, setTeamPolicySetId] = useState('')

  const openLimits = () => {
    setTeamPolicySetId(team?.policySetId ?? '')
    setLimitsOpen(true)
  }

  const updateTeamMutation = useMutation({
    mutationFn: () =>
      updateTeam(team!.id, {
        policySetId: teamPolicySetId || null,
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

  const addMemberMutation = useMutation({
    mutationFn: () =>
      createMember(team!.id, { email: addEmail, name: addName, role: addRole }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
    },
    onError: (err) => {
      setAddError(
        err instanceof ApiError ? err.message : '操作失败，请稍后重试',
      )
    },
  })

  const openAdd = () => {
    setAddEmail('')
    setAddName('')
    setAddRole('member')
    setAddError(null)
    setAddOpen(true)
  }

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    setAddError(null)
    addMemberMutation.mutate()
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
  const roleTemplates: RoleTemplate[] = roleTemplatesQuery.data ?? []
  const policySets: PolicySet[] = policySetsQuery.data ?? []

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
            <Button variant="outline" onClick={openLimits}>
              团队使用限额
            </Button>
            <Button onClick={openAdd}>添加成员</Button>
          </div>
        )}
      </div>

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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
            <DialogDescription>
              填写成员信息，提交后即加入团队
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAdd}>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                邮箱
              </label>
              <Input
                type="email"
                placeholder="成员邮箱"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                用户名
              </label>
              <Input
                placeholder="成员用户名"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                角色
              </label>
              <RoleSelect
                value={addRole}
                onChange={(role) => setAddRole(role)}
              />
            </div>

            {addError && (
              <p className="text-sm text-red-500">{addError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={addMemberMutation.isPending}>
                {addMemberMutation.isPending ? '添加中…' : '添加成员'}
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
              为团队绑定策略集，与成员角色、API Key 的策略取最严格生效
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                团队策略集
              </label>
              <Select
                value={teamPolicySetId || ''}
                onValueChange={(v) => setTeamPolicySetId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {policySets.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
