import type { Namespace } from '@hakorem/i18n';
import type { i18n } from 'i18next';
import type { RouteObject } from 'react-router';
import { appRoutes } from '../app/appRoutes';
import { lazyScreen } from '../app/LazyScreen';
import { OtherDocument } from '../app/OtherDocument';
import { PermissionGate } from '../routing/gates';
import type { RouteHandle } from '../routing/handle';
import { PosShell } from '../shells/PosShell';
import { posAuthRoutes } from './authRoutes';
import { TILL_PARTS } from './parts';
import { SaleScreen } from './screens/SaleScreen';

const till = (permission: string, crumb: RouteHandle['crumb']): RouteHandle => ({
  permission,
  shell: 'pos',
  crumb,
});

/**
 * The till's screens that load on demand. `preloadTillScreens` fetches them all once the till is ready, so
 * a till that loses its network afterwards still opens every one (ADR 0043); a reload with no network is
 * the service worker's (F13, DEPLOYMENT.md section 2). The words they need that the sale screen does not,
 * the shift screens' and the refusals', are namespaces fetched with them (`TILL_NAMESPACES`).
 */
const SCREENS = {
  setup: () => import('./screens/TillSetupScreen').then((m) => m.TillSetupScreen),
  shiftOpen: () => import('./screens/ShiftOpenScreen').then((m) => m.ShiftOpenScreen),
  shift: () => import('./screens/ShiftScreen').then((m) => m.ShiftScreen),
  queue: () => import('./screens/QueueScreen').then((m) => m.QueueScreen),
  returns: () => import('./screens/ReturnsScreen').then((m) => m.ReturnsScreen),
};

/** Catalogue namespaces the till fetches after its first screen, never in its first load. */
export const TILL_NAMESPACES = ['posShift', 'refusals'] as const satisfies readonly Namespace[];

export function preloadTillScreens(i18n?: Pick<i18n, 'loadNamespaces'>): Promise<unknown> {
  return Promise.allSettled([
    ...[...Object.values(SCREENS), ...Object.values(TILL_PARTS)].map((load) => load()),
    ...(i18n === undefined ? [] : [i18n.loadNamespaces([...TILL_NAMESPACES])]),
  ]);
}

/**
 * The till's protected routes (ADR 0030): everything under `/pos`, served by `pos.html`. Each leaf declares
 * its permission in `handle`, as in the back office (routes.test.ts checks both tables).
 *
 * THE RULE (PERFORMANCE_BUDGET, "The till loads its sale screen and nothing else"): the shell and the
 * index route, the sale screen, load with the document. Every other till route is `lazyScreen(...)`.
 * routes.test.ts fails a till route that is not lazy, and `pnpm budget:console` budgets the initial load only.
 */
export const posProtectedRoutes: RouteObject[] = [
  {
    path: 'pos',
    handle: till('pos.sale.create', 'pos'),
    element: (
      <PermissionGate>
        <PosShell />
      </PermissionGate>
    ),
    children: [
      { index: true, element: <SaleScreen />, handle: till('pos.sale.create', 'pos') },
      {
        path: 'setup',
        element: lazyScreen(SCREENS.setup),
        handle: till('pos.device.enrol', 'posSetup'),
      },
      {
        path: 'shift/open',
        element: lazyScreen(SCREENS.shiftOpen),
        handle: till('pos.shift.open', 'posShiftOpen'),
      },
      {
        path: 'shift',
        element: lazyScreen(SCREENS.shift),
        handle: till('pos.sale.create', 'posShift'),
      },
      {
        path: 'queue',
        element: lazyScreen(SCREENS.queue),
        handle: till('pos.sale.create', 'posQueue'),
      },
      {
        path: 'returns',
        element: lazyScreen(SCREENS.returns),
        handle: till('ord.return.create', 'posReturns'),
      },
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
