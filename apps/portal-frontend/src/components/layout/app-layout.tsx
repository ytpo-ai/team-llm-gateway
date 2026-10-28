import { LogOut, Moon, Sun } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store'

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border px-6">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Portal
        </Link>
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
