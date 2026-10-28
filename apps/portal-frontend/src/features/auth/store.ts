import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  getProfile,
  login as apiLogin,
  refresh as apiRefresh,
  register as apiRegister,
} from './api'
import type { LoginInput, RegisterInput, User } from './types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<string | null>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      async login(input) {
        const res = await apiLogin(input)
        set({
          user: res.user,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        })
      },

      async register(input) {
        const res = await apiRegister(input)
        set({
          user: res.user,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        })
      },

      logout() {
        set({ user: null, accessToken: null, refreshToken: null })
      },

      async refreshAccessToken() {
        const current = get().refreshToken
        if (!current) {
          get().logout()
          return null
        }
        try {
          const res = await apiRefresh(current)
          set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          })
          return res.accessToken
        } catch {
          get().logout()
          return null
        }
      },

      async fetchProfile() {
        const res = await getProfile()
        set({ user: res })
      },
    }),
    {
      name: 'portal-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)
