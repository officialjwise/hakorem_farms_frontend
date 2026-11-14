import { describe, expect, it } from 'vitest';
import { operationManifest } from '@hakorem/api-client';
import type { RouteObject } from 'react-router';
import { protectedRoutes } from '../app/routes';
import { isRouteHandle } from './handle';

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

describe('F3 routes declare the permission of the operation they use', () => {
  // Each screen's route permission is the contract's x-permission for its main read (a list or record
  // screen) or its write (a form whose whole purpose is the write). Taken from the generated manifest, so a
  // contract change that renames a permission fails here.
  const EXPECTED: Record<string, keyof typeof operationManifest> = {
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
      operationManifest[operation].permission,
    );
  });
});
