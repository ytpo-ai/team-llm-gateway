import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { useAuthStore } from '@/features/auth/store'
import { router } from '@/router'
import './index.css'

const queryClient = new QueryClient()

const { accessToken, fetchProfile } = useAuthStore.getState()
if (accessToken) {
  void fetchProfile().catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
