import { LogOut, Moon, Sun } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-muted text-foreground'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Portal
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              概览
            </NavLink>
            <NavLink to="/team" className={navLinkClass}>
              团队
            </NavLink>
            <NavLink to="/roles" className={navLinkClass}>
              角色
            </NavLink>
            <NavLink to="/api-keys" className={navLinkClass}>
              API Key
            </NavLink>
            <NavLink to="/billing" className={navLinkClass}>
              额度
            </NavLink>
            <NavLink to="/models" className={navLinkClass}>
              模型
            </NavLink>
            <NavLink to="/recommendation" className={navLinkClass}>
              选型建议
            </NavLink>
            {user?.role === 'team_admin' && (
              <NavLink to="/providers" className={navLinkClass}>
                上游
              </NavLink>
            )}
            {user?.role === 'team_admin' && (
              <NavLink to="/settings" className={navLinkClass}>
                设置
              </NavLink>
            )}
            {user?.role === 'team_admin' && (
              <NavLink to="/audit-logs" className={navLinkClass}>
                审计
              </NavLink>
            )}
            {user?.role === 'system' && (
              <NavLink to="/admin/overview" className={navLinkClass}>
                全局概览
              </NavLink>
            )}
            {user?.role === 'system' && (
              <NavLink to="/admin/tenants" className={navLinkClass}>
                租户
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user && <span className="text-sm text-muted-foreground">{user.name}</span>}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="切换主题">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="退出登录">
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
