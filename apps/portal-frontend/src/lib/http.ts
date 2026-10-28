import { useAuthStore } from '@/features/auth/store'

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
}

async function readError(res: Response): Promise<ApiError> {
  let message = `请求失败（${res.status}）`
  try {
    const data = (await res.json()) as { message?: string | string[] }
    if (Array.isArray(data.message)) {
      message = data.message.join('；')
    } else if (data.message) {
      message = data.message
    }
  } catch {
    // 忽略非 JSON 错误响应体
  }
  return new ApiError(res.status, message)
}

async function doFetch<T>(
  path: string,
  options: RequestOptions,
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) throw await readError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true } = options

  if (!auth) {
    return doFetch<T>(path, options)
  }

  const { accessToken, refreshAccessToken } = useAuthStore.getState()

  try {
    return await doFetch<T>(path, options, accessToken)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !accessToken) {
      throw err
    }
    const newToken = await refreshAccessToken()
    if (!newToken) throw err
    return await doFetch<T>(path, options, newToken)
  }
}
