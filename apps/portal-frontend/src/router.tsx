import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { DashboardPage } from '@/pages/dashboard'
import { InvitePage } from '@/pages/invite'
import { LoginPage } from '@/pages/login'
import { TeamPage } from '@/pages/team'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/invite',
    element: <InvitePage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'team', element: <TeamPage /> },
        ],
      },
    ],
  },
])
