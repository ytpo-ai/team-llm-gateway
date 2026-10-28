import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
])
