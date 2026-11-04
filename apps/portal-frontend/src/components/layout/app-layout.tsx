import {
  Boxes,
  Building2,
  CreditCard,
  FileClock,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordDialog } from '@/features/auth/components/change-password-dialog'
import { useAuthStore } from '@/features/auth/store'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  end?: boolean
  icon: LucideIcon
}

interface NavSection {
  title: string
  items: NavItem[]
}

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [passwordOpen, setPasswordOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-muted text-foreground'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    )

  const isTeamManager =
    user?.role === 'team_admin' || user?.role === 'system'
  const isSystem = user?.role === 'system'

  const sections: NavSection[] = [
    {
      title: '团队管理',
      items: [
        { label: '成员管理', to: '/team', icon: Users },
        { label: '角色管理', to: '/roles', icon: ShieldCheck },
        { label: '策略管理', to: '/policy-sets', icon: SlidersHorizontal },
        { label: 'API Key', to: '/api-keys', icon: KeyRound },
        { label: '选型建议', to: '/recommendation', icon: Sparkles },
      ],
    },
    {
      title: 'LLM管理',
      items: [
        ...(isTeamManager
          ? [{ label: '渠道管理', to: '/providers', icon: Server }]
          : []),
        { label: '模型管理', to: '/models', icon: Boxes },
      ],
    },
    {
      title: '系统管理',
      items: [
        ...(isTeamManager
          ? [{ label: '系统设置', to: '/settings', icon: Settings }]
          : []),
        ...(isTeamManager
          ? [{ label: '额度管理', to: '/quota-topup', icon: CreditCard }]
          : []),
        ...(isSystem
          ? [{ label: '租户管理', to: '/admin/tenants', icon: Building2 }]
          : []),
        ...(isSystem
          ? [{ label: '全局看板', to: '/admin/overview', icon: LayoutDashboard }]
          : []),
      ],
    },
    {
      title: '观察',
      items: [
        { label: '用量看板', to: '/', end: true, icon: Gauge },
        { label: '余额与流水', to: '/billing', icon: Wallet },
        ...(isTeamManager
          ? [{ label: '使用日志', to: '/usage-logs', icon: ScrollText }]
          : []),
        ...(isTeamManager
          ? [{ label: '审计日志', to: '/audit-logs', icon: FileClock }]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            LLM-Gateway
          </Link>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={navLinkClass}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {user && (
            <span className="truncate text-sm text-muted-foreground">
              {user.name}
            </span>
          )}
        </div>
      </aside>
      <div className="pl-64">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-end border-b border-border px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="切换主题"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="max-w-40 truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                  <KeyRound />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="container mx-auto p-6">
          <Outlet />
        </main>
        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      </div>
    </div>
  )
}
