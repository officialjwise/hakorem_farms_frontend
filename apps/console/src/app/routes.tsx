import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import { Skeleton } from '@hakorem/ui';
import { useTranslation } from 'react-i18next';
import { ChangePasswordScreen } from '../auth/screens/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '../auth/screens/LoginScreen';
import { ResetPasswordScreen } from '../auth/screens/ResetPasswordScreen';
import { TotpScreen } from '../auth/screens/TotpScreen';
import { AuditEventScreen } from '../audit/AuditEventScreen';
import { AuditScreen } from '../audit/AuditScreen';
import { RoleDetailScreen, RoleNewScreen } from '../iam/RoleScreen';
import { RolesScreen } from '../iam/RolesScreen';
import { SessionsScreen } from '../iam/SessionsScreen';
import { UserCreateScreen } from '../iam/UserCreateScreen';
import { UserDetailScreen } from '../iam/UserDetailScreen';
import { UsersScreen } from '../iam/UsersScreen';
import { PermissionGate, SessionGate } from '../routing/gates';
import type { RouteHandle } from '../routing/handle';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { PosHome } from '../screens/PosHome';
import { BackOfficeShell } from '../shells/BackOfficeShell';
import { RouteErrorFallback } from './ErrorBoundary';
import { RootLayout } from './RootLayout';

// The POS shell is its own chunk: the back office never downloads it, and it can be cached on its own in F13.
const PosShell = lazy(() => import('../shells/PosShell').then((m) => ({ default: m.PosShell })));

function Loading() {
  const { t } = useTranslation('shell');
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <Skeleton label={t('session.checking')} shape="block" />
      </div>
    </div>
  );
}

const back = (permission: string | null, crumb: RouteHandle['crumb']): RouteHandle => ({
  permission,
  shell: 'back-office',
  crumb,
});

/** Everything behind sign-in. Each leaf must declare its permission in `handle` (routes.test.ts checks). */
export const protectedRoutes: RouteObject[] = [
  {
    element: <BackOfficeShell />,
    children: [
      {
        index: true,
        element: <PlaceholderScreen area="dashboard" />,
        handle: back(null, 'dashboard'),
      },
      {
        path: 'stock',
        element: <PlaceholderScreen area="stock" />,
        handle: back('inv.stock.read', 'stock'),
      },
      {
        path: 'products',
        element: <PlaceholderScreen area="products" />,
        handle: back('mdm.product.read', 'products'),
      },
      {
        path: 'orders',
        element: <PlaceholderScreen area="orders" />,
        handle: back('ord.order.read', 'orders'),
      },
      // F3. Each leaf's permission is the x-permission of the operation it reads (or, for a form, writes).
      {
        path: 'users',
        handle: back('iam.user.read', 'users'),
        children: [
          { index: true, element: <UsersScreen />, handle: back('iam.user.read', 'users') },
          {
            path: 'new',
            element: <UserCreateScreen />,
            handle: back('iam.user.create', 'userNew'),
          },
          {
            path: ':id',
            element: <UserDetailScreen />,
            handle: back('iam.user.read', 'userDetail'),
          },
        ],
      },
      {
        path: 'roles',
        handle: back('iam.role.read', 'roles'),
        children: [
          { index: true, element: <RolesScreen />, handle: back('iam.role.read', 'roles') },
          { path: 'new', element: <RoleNewScreen />, handle: back('iam.role.manage', 'roleNew') },
          {
            path: ':id',
            element: <RoleDetailScreen />,
            handle: back('iam.role.read', 'roleDetail'),
          },
        ],
      },
      {
        path: 'sessions',
        element: <SessionsScreen />,
        handle: back('iam.session.read', 'sessions'),
      },
      {
        path: 'audit',
        handle: back('aud.audit.read', 'audit'),
        children: [
          { index: true, element: <AuditScreen />, handle: back('aud.audit.read', 'audit') },
          {
            path: ':id',
            element: <AuditEventScreen />,
            handle: back('aud.audit.read', 'auditEvent'),
          },
        ],
      },
    ],
  },
  {
    path: 'pos',
    handle: {
      permission: 'pos.sale.create',
      shell: 'pos',
      crumb: 'pos',
    } satisfies RouteHandle,
    element: (
      <PermissionGate>
        <Suspense fallback={<Loading />}>
          <PosShell />
        </Suspense>
      </PermissionGate>
    ),
    children: [
      {
        index: true,
        element: <PosHome />,
        handle: {
          permission: 'pos.sale.create',
          shell: 'pos',
          crumb: 'pos',
        } satisfies RouteHandle,
      },
    ],
  },
];

/** Public routes need no session, so they declare no permission. Everything under `SessionGate` must declare one. */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: 'login', element: <LoginScreen /> },
      { path: 'login/totp', element: <TotpScreen /> },
      { path: 'change-password', element: <ChangePasswordScreen /> },
      { path: 'forgot-password', element: <ForgotPasswordScreen /> },
      { path: 'reset-password', element: <ResetPasswordScreen /> },
      {
        element: (
          <SessionGate>
            <Outlet />
          </SessionGate>
        ),
        children: protectedRoutes,
      },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
