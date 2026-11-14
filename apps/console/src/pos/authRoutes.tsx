import type { RouteObject } from 'react-router';
import { lazyScreen } from '../app/LazyScreen';

/**
 * The sign-in routes as the till serves them: on demand (PERFORMANCE_BUDGET, "The till loads its sale
 * screen and nothing else"). A till spends its shift on the sale screen, so it does not download the
 * sign-in forms with it. The paths match the back office's (app/authRoutes.tsx).
 */
export const posAuthRoutes: RouteObject[] = [
  {
    path: 'login',
    element: lazyScreen(() => import('../auth/screens/LoginScreen').then((m) => m.LoginScreen)),
  },
  {
    path: 'login/totp',
    element: lazyScreen(() => import('../auth/screens/TotpScreen').then((m) => m.TotpScreen)),
  },
  {
    path: 'change-password',
    element: lazyScreen(() =>
      import('../auth/screens/ChangePasswordScreen').then((m) => m.ChangePasswordScreen),
    ),
  },
  {
    path: 'forgot-password',
    element: lazyScreen(() =>
      import('../auth/screens/ForgotPasswordScreen').then((m) => m.ForgotPasswordScreen),
    ),
  },
  {
    path: 'reset-password',
    element: lazyScreen(() =>
      import('../auth/screens/ResetPasswordScreen').then((m) => m.ResetPasswordScreen),
    ),
  },
];
