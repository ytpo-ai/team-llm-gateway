import { request } from '@/lib/http'
import type { AuthResponse, LoginInput, RegisterInput, TokenPair, User } from './types'

export function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  })
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  })
}

export function refresh(refreshToken: string): Promise<TokenPair> {
  return request<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  })
}

export function getProfile(): Promise<User> {
  return request<User>('/auth/profile')
}
