import { Outlet, type RouteObject } from 'react-router';
import { ChangePasswordScreen } from '../auth/screens/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '../auth/screens/LoginScreen';
import { ResetPasswordScreen } from '../auth/screens/ResetPasswordScreen';
import { TotpScreen } from '../auth/screens/TotpScreen';
import { SessionGate } from '../routing/gates';
import { RouteErrorFallback } from './ErrorBoundary';
import { RootLayout } from './RootLayout';

/**
 * The frame both documents share (ADR 0030): the root layout, the public sign-in routes, and the session
 * gate around the document's own protected routes. Public routes need no session, so they declare no
 * permission. Everything under `SessionGate` must declare one (routes.test.ts checks).
 *
 * `rest` comes after the protected routes: the back office's hand-off for `/pos` and its not-found page,
 * or the till's hand-off for everything it does not own.
 */
export function appRoutes(protectedRoutes: RouteObject[], rest: RouteObject[]): RouteObject[] {
  return [
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
        ...rest,
      ],
    },
  ];
}
