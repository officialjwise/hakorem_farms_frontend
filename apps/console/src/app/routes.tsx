import type { RouteObject } from 'react-router';
import { AuditEventScreen } from '../audit/AuditEventScreen';
import { AuditScreen } from '../audit/AuditScreen';
import { RoleDetailScreen, RoleNewScreen } from '../iam/RoleScreen';
import { RolesScreen } from '../iam/RolesScreen';
import { SessionsScreen } from '../iam/SessionsScreen';
import { UserCreateScreen } from '../iam/UserCreateScreen';
import { UserDetailScreen } from '../iam/UserDetailScreen';
import { UsersScreen } from '../iam/UsersScreen';
import type { RouteHandle } from '../routing/handle';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { BackOfficeShell } from '../shells/BackOfficeShell';
import { appRoutes } from './appRoutes';
import { lazyScreen } from './LazyScreen';
import { authRoutes } from './authRoutes';
import { OtherDocument } from './OtherDocument';

/*
 * The back office document's routes (ADR 0030). The POS is the other document, `pos.html`, with its own
 * routes in pos/routes.tsx: nothing here imports it, so the till never downloads these screens.
 */

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
      // F4, each loaded on demand so the back office's first load stays in budget (PERFORMANCE_BUDGET).
      {
        path: 'products',
        handle: back('mdm.product.read', 'products'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../catalogue/ProductsScreen').then((m) => m.ProductsScreen),
            ),
            handle: back('mdm.product.read', 'products'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../catalogue/ProductCreateScreen').then((m) => m.ProductCreateScreen),
            ),
            handle: back('mdm.product.create', 'productNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../catalogue/ProductScreen').then((m) => m.ProductScreen),
            ),
            handle: back('mdm.product.read', 'productDetail'),
          },
        ],
      },
      {
        path: 'categories',
        element: lazyScreen(() =>
          import('../catalogue/CategoriesScreen').then((m) => m.CategoriesScreen),
        ),
        handle: back('mdm.category.read', 'categories'),
      },
      {
        // `listUnitsOfMeasure` is read with `mdm.product.read`.
        path: 'units',
        element: lazyScreen(() => import('../catalogue/UnitsScreen').then((m) => m.UnitsScreen)),
        handle: back('mdm.product.read', 'units'),
      },
      {
        path: 'species',
        handle: back('mdm.species.read', 'species'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../catalogue/SpeciesScreen').then((m) => m.SpeciesScreen),
            ),
            handle: back('mdm.species.read', 'species'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../catalogue/SpeciesDetailScreen').then((m) => m.SpeciesDetailScreen),
            ),
            handle: back('mdm.species.read', 'speciesDetail'),
          },
        ],
      },
      {
        path: 'price-lists',
        handle: back('mdm.price_list.read', 'priceLists'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../pricing/PriceListsScreen').then((m) => m.PriceListsScreen),
            ),
            handle: back('mdm.price_list.read', 'priceLists'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../pricing/PriceListScreen').then((m) => m.PriceListScreen),
            ),
            handle: back('mdm.price_list.read', 'priceListDetail'),
          },
        ],
      },
      {
        path: 'price-list-versions/:id',
        element: lazyScreen(() =>
          import('../pricing/PriceListVersionScreen').then((m) => m.PriceListVersionScreen),
        ),
        handle: back('mdm.price_list.read', 'priceListVersion'),
      },
      {
        path: 'orders',
        element: <PlaceholderScreen area="orders" />,
        handle: back('ord.order.read', 'orders'),
      },
      // F3. Each leaf's permission is the x-permission of the operation it reads (or, for a form, writes).
      {
        path: 'users',
        handle: back('iam.user.read', 'users'),
        children: [
          { index: true, element: <UsersScreen />, handle: back('iam.user.read', 'users') },
          {
            path: 'new',
            element: <UserCreateScreen />,
            handle: back('iam.user.create', 'userNew'),
          },
          {
            path: ':id',
            element: <UserDetailScreen />,
            handle: back('iam.user.read', 'userDetail'),
          },
        ],
      },
      {
        path: 'roles',
        handle: back('iam.role.read', 'roles'),
        children: [
          { index: true, element: <RolesScreen />, handle: back('iam.role.read', 'roles') },
          { path: 'new', element: <RoleNewScreen />, handle: back('iam.role.manage', 'roleNew') },
          {
            path: ':id',
            element: <RoleDetailScreen />,
            handle: back('iam.role.read', 'roleDetail'),
          },
        ],
      },
      {
        path: 'sessions',
        element: <SessionsScreen />,
        handle: back('iam.session.read', 'sessions'),
      },
      {
        path: 'audit',
        handle: back('aud.audit.read', 'audit'),
        children: [
          { index: true, element: <AuditScreen />, handle: back('aud.audit.read', 'audit') },
          {
            path: ':id',
            element: <AuditEventScreen />,
            handle: back('aud.audit.read', 'auditEvent'),
          },
        ],
      },
    ],
  },
];

export const routes: RouteObject[] = appRoutes({
  publicRoutes: authRoutes,
  protectedRoutes,
  rest: [
    // The till's addresses belong to pos.html. An in-app link here (the sidebar's POS item, the sign-in
    // screen's `next`) is handed to the browser to load that document.
    { path: 'pos/*', element: <OtherDocument /> },
    { path: '*', element: <NotFoundScreen /> },
  ],
});
