import type { RouteObject } from 'react-router';
import { ChangePasswordScreen } from '../auth/screens/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '../auth/screens/LoginScreen';
import { ResetPasswordScreen } from '../auth/screens/ResetPasswordScreen';
import { TotpScreen } from '../auth/screens/TotpScreen';

/**
 * The sign-in routes as the back office document serves them: loaded with the document, because
 * `/login` is where a signed-out person lands. They need no session, so they declare no permission.
 * The till loads the same screens on demand (pos/authRoutes.tsx).
 */
export const authRoutes: RouteObject[] = [
  { path: 'login', element: <LoginScreen /> },
  { path: 'login/totp', element: <TotpScreen /> },
  { path: 'change-password', element: <ChangePasswordScreen /> },
  { path: 'forgot-password', element: <ForgotPasswordScreen /> },
  { path: 'reset-password', element: <ResetPasswordScreen /> },
];
