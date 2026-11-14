import { Outlet, type RouteObject } from 'react-router';
import { SessionGate } from '../routing/gates';
import { RouteErrorFallback } from './ErrorBoundary';
import { RootLayout } from './RootLayout';

/**
 * The frame both documents share (ADR 0030): the root layout, the public sign-in routes, and the session
 * gate around the document's own protected routes. Public routes need no session, so they declare no
 * permission. Everything under `SessionGate` must declare one (routes.test.ts checks).
 *
 * Each document passes its own sign-in routes: the back office loads them with the document
 * (app/authRoutes.tsx), the till on demand (pos/authRoutes.tsx). `rest` comes after the protected routes:
 * the back office's hand-off for `/pos` and its not-found page, or the till's hand-off for everything it
 * does not own.
 */
export function appRoutes({
  publicRoutes,
  protectedRoutes,
  rest,
}: {
  publicRoutes: RouteObject[];
  protectedRoutes: RouteObject[];
  rest: RouteObject[];
}): RouteObject[] {
  return [
    {
      element: <RootLayout />,
      errorElement: <RouteErrorFallback />,
      children: [
        ...publicRoutes,
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
