import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { AdminOverviewPage } from '@/pages/admin-overview'
import { AdminTenantsPage } from '@/pages/admin-tenants'
import { ApiKeysPage } from '@/pages/api-keys'
import { AuditLogsPage } from '@/pages/audit-logs'
import { BillingPage } from '@/pages/billing'
import { DashboardPage } from '@/pages/dashboard'
import { InvitePage } from '@/pages/invite'
import { LoginPage } from '@/pages/login'
import { ModelsPage } from '@/pages/models'
import { PolicySetsPage } from '@/pages/policy-sets'
import { ProvidersPage } from '@/pages/providers'
import { RecommendationPage } from '@/pages/recommendation'
import { RolesPage } from '@/pages/roles'
import { SettingsPage } from '@/pages/settings'
import { TeamPage } from '@/pages/team'
import { UsageLogsPage } from '@/pages/usage-logs'

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
          { path: 'roles', element: <RolesPage /> },
          { path: 'policy-sets', element: <PolicySetsPage /> },
          { path: 'api-keys', element: <ApiKeysPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'providers', element: <ProvidersPage /> },
          { path: 'models', element: <ModelsPage /> },
          { path: 'recommendation', element: <RecommendationPage /> },
          { path: 'usage-logs', element: <UsageLogsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'audit-logs', element: <AuditLogsPage /> },
          { path: 'admin/tenants', element: <AdminTenantsPage /> },
          { path: 'admin/overview', element: <AdminOverviewPage /> },
        ],
      },
    ],
  },
])
