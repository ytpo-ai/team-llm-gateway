import { Moon, Sun } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useTheme } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'

export function AppLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border px-6">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Portal
        </Link>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="切换主题">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </header>
      <main className="container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
