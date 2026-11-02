export type Role = 'system' | 'team_admin' | 'member'

export interface User {
  id: string
  email: string | null
  name: string
  role: Role
  tenantId: string
  teamId: string | null
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  tenantName?: string
}
