import type { RouteObject } from 'react-router';
import { appRoutes } from '../app/appRoutes';
import { OtherDocument } from '../app/OtherDocument';
import { PermissionGate } from '../routing/gates';
import type { RouteHandle } from '../routing/handle';
import { PosHome } from '../screens/PosHome';
import { PosShell } from '../shells/PosShell';
import { posAuthRoutes } from './authRoutes';

const till: RouteHandle = { permission: 'pos.sale.create', shell: 'pos', crumb: 'pos' };

/**
 * The till's protected routes (ADR 0030): everything under `/pos`, served by `pos.html`. Each leaf declares
 * its permission in `handle`, as in the back office (routes.test.ts checks both tables).
 *
 * THE RULE (PERFORMANCE_BUDGET, "The till loads its sale screen and nothing else"): the shell and the
 * index route, the sale screen, load with the document. Every other till route is `lazyScreen(...)`: hold
 * and recall, returns, shift open and close, anything F9 adds. routes.test.ts fails a till route that is
 * not lazy, and `pnpm budget:console` budgets the initial load only.
 */
export const posProtectedRoutes: RouteObject[] = [
  {
    path: 'pos',
    handle: till,
    element: (
      <PermissionGate>
        <PosShell />
      </PermissionGate>
    ),
    children: [
      // The sale screen. Until F9 it is the empty state under the scan bar.
      { index: true, element: <PosHome />, handle: till },
    ],
  },
];

/**
 * The till document's routes. It renders the sign-in screens itself, on demand (a cashier who signs out and
 * in again stays on this document's code), and hands every other address to the back office document:
 * "Back office", "Go to the start page", and the back office's own not-found page.
 */
export const posRoutes: RouteObject[] = appRoutes({
  publicRoutes: posAuthRoutes,
  protectedRoutes: posProtectedRoutes,
  rest: [{ path: '*', element: <OtherDocument /> }],
});
