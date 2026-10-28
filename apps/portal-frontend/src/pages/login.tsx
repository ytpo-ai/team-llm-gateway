import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/store'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({
          name,
          email,
          password,
          tenantName: tenantName.trim() || undefined,
        })
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'login' ? '登录 Portal' : '初始化团队'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? '使用团队账号登录，管理你的 AI 接入'
              : '首次使用请创建管理员账号，将自动初始化默认团队'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-input p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'login' ? '登录' : '初始化'}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <Input
                  placeholder="姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
                <Input
                  placeholder="团队名称（可选）"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                />
              </>
            )}
            <Input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="密码（至少 8 位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '处理中…' : mode === 'login' ? '登录' : '创建并登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
