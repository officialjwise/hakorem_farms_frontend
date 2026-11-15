import type { RouteObject } from 'react-router';
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
        // The start page for everyone; its content needs rpt.dashboard.owner and says so in words.
        index: true,
        element: lazyScreen(() =>
          import('../dashboard/DashboardScreen').then((m) => m.DashboardScreen),
        ),
        handle: back(null, 'dashboard'),
      },
      // F5, loaded on demand (ADR 0032).
      {
        path: 'stock',
        element: lazyScreen(() =>
          import('../stock/StockOnHandScreen').then((m) => m.StockOnHandScreen),
        ),
        handle: back('inv.stock.read', 'stock'),
      },
      {
        path: 'stock-takes',
        handle: back('inv.stock_take.read', 'stockTakes'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../stock/StockTakesScreen').then((m) => m.StockTakesScreen),
            ),
            handle: back('inv.stock_take.read', 'stockTakes'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../stock/StockTakeScreen').then((m) => m.StockTakeScreen),
            ),
            handle: back('inv.stock_take.read', 'stockTake'),
          },
        ],
      },
      {
        path: 'stock-adjustments',
        handle: back('inv.adjustment.read', 'adjustments'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../stock/MoveScreens').then((m) => m.AdjustmentsScreen),
            ),
            handle: back('inv.adjustment.read', 'adjustments'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../stock/NewMoveScreens').then((m) => m.AdjustmentNewScreen),
            ),
            handle: back('inv.adjustment.create', 'adjustmentNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../stock/MoveScreens').then((m) => m.AdjustmentScreen),
            ),
            handle: back('inv.adjustment.read', 'adjustment'),
          },
        ],
      },
      {
        path: 'stock-transfers',
        handle: back('inv.transfer.read', 'transfers'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../stock/MoveScreens').then((m) => m.TransfersScreen),
            ),
            handle: back('inv.transfer.read', 'transfers'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../stock/NewMoveScreens').then((m) => m.TransferNewScreen),
            ),
            handle: back('inv.transfer.create', 'transferNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() => import('../stock/MoveScreens').then((m) => m.TransferScreen)),
            handle: back('inv.transfer.read', 'transfer'),
          },
        ],
      },
      {
        path: 'goods-receipts',
        handle: back('inv.goods_receipt.read', 'receipts'),
        children: [
          {
            index: true,
            element: lazyScreen(() => import('../stock/MoveScreens').then((m) => m.ReceiptsScreen)),
            handle: back('inv.goods_receipt.read', 'receipts'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../stock/NewMoveScreens').then((m) => m.ReceiptNewScreen),
            ),
            handle: back('inv.goods_receipt.create', 'receiptNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() => import('../stock/MoveScreens').then((m) => m.ReceiptScreen)),
            handle: back('inv.goods_receipt.read', 'receipt'),
          },
        ],
      },
      // F5b, loaded on demand (ADR 0032).
      {
        path: 'branches',
        handle: back('mdm.branch.read', 'branches'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../branches/BranchesScreen').then((m) => m.BranchesScreen),
            ),
            handle: back('mdm.branch.read', 'branches'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../branches/BranchScreen').then((m) => m.BranchScreen),
            ),
            handle: back('mdm.branch.read', 'branchDetail'),
          },
        ],
      },
      {
        path: 'labels',
        element: lazyScreen(() => import('../labels/LabelsScreen').then((m) => m.LabelsScreen)),
        handle: back('mdm.product.read', 'labels'),
      },
      {
        path: 'lots',
        element: lazyScreen(() => import('../lists/ListScreens').then((m) => m.LotsScreen)),
        handle: back('inv.stock.read', 'lots'),
      },
      {
        path: 'movements',
        element: lazyScreen(() => import('../lists/ListScreens').then((m) => m.MovementsScreen)),
        handle: back('inv.movement.read', 'movements'),
      },
      {
        path: 'suppliers',
        element: lazyScreen(() => import('../lists/ListScreens').then((m) => m.SuppliersScreen)),
        handle: back('mdm.supplier.read', 'suppliers'),
      },
      {
        path: 'registers',
        element: lazyScreen(() => import('../lists/ListScreens').then((m) => m.RegistersScreen)),
        handle: back('pos.register.read', 'registers'),
      },
      {
        path: 'reports',
        handle: back('rpt.report.read', 'reports'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../reports/ReportScreens').then((m) => m.ReportsScreen),
            ),
            handle: back('rpt.report.read', 'reports'),
          },
          {
            path: ':report',
            element: lazyScreen(() =>
              import('../reports/ReportScreens').then((m) => m.ReportScreen),
            ),
            handle: back('rpt.report.read', 'report'),
          },
        ],
      },
      // F5c: the settings section. Display is anyone's; the business and system settings need aud.setting.read.
      {
        path: 'settings',
        handle: back(null, 'settings'),
        element: lazyScreen(() =>
          import('../settings/SettingsScreens').then((m) => m.SettingsLayout),
        ),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../settings/SettingsScreens').then((m) => m.DisplaySettingsScreen),
            ),
            handle: back(null, 'settings'),
          },
          {
            path: 'business',
            element: lazyScreen(() =>
              import('../settings/SettingsScreens').then((m) => m.BusinessProfileScreen),
            ),
            handle: back('aud.setting.read', 'settingsBusiness'),
          },
          {
            path: 'system',
            element: lazyScreen(() =>
              import('../settings/SettingsScreens').then((m) => m.SystemSettingsScreen),
            ),
            handle: back('aud.setting.read', 'settingsSystem'),
          },
        ],
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
          {
            index: true,
            element: lazyScreen(() => import('../iam/UsersScreen').then((m) => m.UsersScreen)),
            handle: back('iam.user.read', 'users'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../iam/UserCreateScreen').then((m) => m.UserCreateScreen),
            ),
            handle: back('iam.user.create', 'userNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../iam/UserDetailScreen').then((m) => m.UserDetailScreen),
            ),
            handle: back('iam.user.read', 'userDetail'),
          },
        ],
      },
      {
        path: 'roles',
        handle: back('iam.role.read', 'roles'),
        children: [
          {
            index: true,
            element: lazyScreen(() => import('../iam/RolesScreen').then((m) => m.RolesScreen)),
            handle: back('iam.role.read', 'roles'),
          },
          {
            path: 'new',
            element: lazyScreen(() => import('../iam/RoleScreen').then((m) => m.RoleNewScreen)),
            handle: back('iam.role.manage', 'roleNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() => import('../iam/RoleScreen').then((m) => m.RoleDetailScreen)),
            handle: back('iam.role.read', 'roleDetail'),
          },
        ],
      },
      {
        path: 'sessions',
        element: lazyScreen(() => import('../iam/SessionsScreen').then((m) => m.SessionsScreen)),
        handle: back('iam.session.read', 'sessions'),
      },
      {
        path: 'audit',
        handle: back('aud.audit.read', 'audit'),
        children: [
          {
            index: true,
            element: lazyScreen(() => import('../audit/AuditScreen').then((m) => m.AuditScreen)),
            handle: back('aud.audit.read', 'audit'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../audit/AuditEventScreen').then((m) => m.AuditEventScreen),
            ),
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
