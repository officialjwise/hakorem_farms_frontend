import { describe, expect, it } from 'vitest';
import { operationPermissions } from '@hakorem/api-client';
import { isValidElement } from 'react';
import type { RouteObject } from 'react-router';
import { entryFor } from '../app/entries';
import { LazyScreen } from '../app/LazyScreen';
import { protectedRoutes as backOfficeRoutes } from '../app/routes';
import { investorProtectedRoutes } from '../investor/routes';
import { posProtectedRoutes, posRoutes } from '../pos/routes';
import { isRouteHandle } from './handle';

/** Every document's protected routes (ADR 0030, ADR 0058): every rule below holds for each. */
const protectedRoutes = [...backOfficeRoutes, ...posProtectedRoutes, ...investorProtectedRoutes];

function leaves(list: RouteObject[], trail = ''): { path: string; route: RouteObject }[] {
  return list.flatMap((route) => {
    const path = route.path === undefined ? trail : `${trail}/${route.path}`;
    const children = route.children ?? [];
    return children.length === 0 ? [{ path: path || '/', route }] : leaves(children, path);
  });
}

describe('route table', () => {
  it('every console route behind sign-in declares the permission it needs', () => {
    const behind = leaves(protectedRoutes);
    expect(behind.length).toBeGreaterThanOrEqual(6);
    for (const { path, route } of behind) {
      expect(isRouteHandle(route.handle), `${path} has no handle.permission`).toBe(true);
    }
  });

  it('declares contract permission codes, or null for any signed-in user', () => {
    const declared = leaves(protectedRoutes).map(({ route }) =>
      isRouteHandle(route.handle) ? route.handle.permission : undefined,
    );
    expect(declared).toEqual(
      expect.arrayContaining([
        null,
        'inv.stock.read',
        'mdm.product.read',
        'ord.order.read',
        'iam.user.read',
        'pos.sale.create',
      ]),
    );
  });

  it('every route names its shell and a breadcrumb', () => {
    for (const { path, route } of leaves(protectedRoutes)) {
      expect(
        isRouteHandle(route.handle) && route.handle.shell && route.handle.crumb,
        path,
      ).toBeTruthy();
    }
  });
});

describe('each document owns only its own addresses (ADR 0030)', () => {
  it('the back office declares no till route, and the till declares nothing but /pos', () => {
    for (const { path } of leaves(backOfficeRoutes))
      expect(entryFor(path), path).toBe('back-office');
    const till = leaves(posProtectedRoutes);
    expect(till.length).toBeGreaterThan(0);
    for (const { path } of till) expect(entryFor(path), path).toBe('pos');
  });

  it('the investor portal is its own build: its pages sit at its own root, with no permission (ADR 0058)', () => {
    const portal = leaves(investorProtectedRoutes);
    expect(portal.map(({ path }) => path).sort()).toEqual([
      '/',
      '/capital',
      '/distributions',
      '/documents',
      '/statement',
    ]);
    for (const { path, route } of portal) {
      expect(isRouteHandle(route.handle) && route.handle.permission, path).toBeNull();
    }
    // The console's address never serves it: `/investor` there is the back office's, like any address.
    expect(['/investor', '/investor/', '/investor/login'].map(entryFor)).toEqual(
      Array(3).fill('back-office'),
    );
  });

  it('routes /pos and below to the till, and everything else, files included, to the back office', () => {
    expect(['/pos', '/pos/', '/pos/sale/1'].map(entryFor)).toEqual(['pos', 'pos', 'pos']);
    expect(['/', '/users', '/login', '/posters', '/pos.html', '/pos/x.js'].map(entryFor)).toEqual(
      Array(6).fill('back-office'),
    );
  });
});

describe('the till loads its sale screen and nothing else (PERFORMANCE_BUDGET)', () => {
  const isLazy = (route: RouteObject) =>
    isValidElement(route.element) && route.element.type === LazyScreen;

  it('every till route but the sale screen and the hand-off is a lazy screen', () => {
    const eager = leaves(posRoutes)
      .filter(({ route }) => !isLazy(route))
      .map(({ path }) => path);
    // `/pos` is the sale screen (the index route); `/*` hands other addresses to the back office.
    expect(eager.sort()).toEqual(['/*', '/pos']);
  });

  it('the sign-in screens are among the lazy ones', () => {
    const lazy = leaves(posRoutes)
      .filter(({ route }) => isLazy(route))
      .map(({ path }) => path);
    expect(lazy).toEqual(
      expect.arrayContaining(['/login', '/login/totp', '/change-password', '/forgot-password']),
    );
  });
});

describe('F3 routes declare the permission of the operation they use', () => {
  // Each screen's route permission is the contract's x-permission for its main read (a list or record
  // screen) or its write (a form whose whole purpose is the write). Taken from the generated table, so a
  // contract change that renames a permission fails here.
  const EXPECTED: Record<string, keyof typeof operationPermissions> = {
    '/users': 'listUsers',
    '/users/new': 'createUser',
    '/users/:id': 'getUser',
    '/roles': 'listRoles',
    '/roles/new': 'createRole',
    '/roles/:id': 'getRole',
    '/sessions': 'listSessions',
    '/audit': 'listAuditEvents',
    '/audit/:id': 'getAuditEvent',
  };

  it.each(Object.entries(EXPECTED))('%s needs what %s needs', (path, operation) => {
    const leaf = leaves(protectedRoutes).find((l) => l.path === path);
    expect(leaf, `${path} is not a route`).toBeDefined();
    const handle = leaf?.route.handle;
    expect(isRouteHandle(handle) ? handle.permission : undefined).toBe(
      operationPermissions[operation],
    );
  });
});
