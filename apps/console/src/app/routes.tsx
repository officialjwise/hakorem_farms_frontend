import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import { Skeleton } from '@hakorem/ui';
import { useTranslation } from 'react-i18next';
import { ChangePasswordScreen } from '../auth/screens/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '../auth/screens/LoginScreen';
import { ResetPasswordScreen } from '../auth/screens/ResetPasswordScreen';
import { TotpScreen } from '../auth/screens/TotpScreen';
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
      {
        path: 'users',
        element: <PlaceholderScreen area="users" />,
        handle: back('iam.user.read', 'users'),
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
