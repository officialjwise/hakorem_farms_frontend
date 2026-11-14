import type { RouteObject } from 'react-router';
import { appRoutes } from '../app/appRoutes';
import { OtherDocument } from '../app/OtherDocument';
import { PermissionGate } from '../routing/gates';
import type { RouteHandle } from '../routing/handle';
import { PosHome } from '../screens/PosHome';
import { PosShell } from '../shells/PosShell';

const till: RouteHandle = { permission: 'pos.sale.create', shell: 'pos', crumb: 'pos' };

/**
 * The till's protected routes (ADR 0030): everything under `/pos`, served by `pos.html`. Each leaf declares
 * its permission in `handle`, as in the back office (routes.test.ts checks both tables).
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
    children: [{ index: true, element: <PosHome />, handle: till }],
  },
];

/**
 * The till document's routes. It renders the sign-in screens in place (a cashier who signs out and in
 * again stays on this document's code), and hands every other address to the back office document:
 * "Back office", "Go to the start page", and the back office's own not-found page.
 */
export const posRoutes: RouteObject[] = appRoutes(posProtectedRoutes, [
  { path: '*', element: <OtherDocument /> },
]);
