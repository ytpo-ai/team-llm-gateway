import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
])
