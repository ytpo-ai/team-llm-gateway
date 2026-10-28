export type Role =
  | 'team_admin'
  | 'member'
  | 'finance'
  | 'viewer'
  | 'provider'
  | 'system'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  tenantId: string
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
