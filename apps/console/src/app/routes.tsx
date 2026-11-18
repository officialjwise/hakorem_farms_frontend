import type { RouteObject } from 'react-router';
import type { RouteHandle } from '../routing/handle';
import { NotFoundScreen } from '../screens/NotFoundScreen';
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

/** A driver's screen: the run they are given, on a phone (F11). */
const driver = (
  crumb: RouteHandle['crumb'],
  permission = 'del.delivery.read.assigned',
): RouteHandle => ({ permission, shell: 'driver', crumb });

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
      // The egg session: buying from suppliers, loaded on demand (ADR 0032).
      {
        path: 'purchase-orders',
        handle: back('pur.purchase_order.read', 'purchaseOrders'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../buying/PurchaseOrderScreens').then((m) => m.PurchaseOrdersScreen),
            ),
            handle: back('pur.purchase_order.read', 'purchaseOrders'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../buying/PurchaseOrderScreens').then((m) => m.PurchaseOrderNewScreen),
            ),
            handle: back('pur.purchase_order.create', 'purchaseOrderNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../buying/PurchaseOrderScreens').then((m) => m.PurchaseOrderScreen),
            ),
            handle: back('pur.purchase_order.read', 'purchaseOrder'),
          },
        ],
      },
      // F10g: supplier invoices, payments, claims and accounts, loaded on demand (ADR 0032).
      {
        path: 'supplier-invoices',
        handle: back('pur.supplier_invoice.read', 'supplierInvoices'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../payables/InvoiceScreens').then((m) => m.SupplierInvoicesScreen),
            ),
            handle: back('pur.supplier_invoice.read', 'supplierInvoices'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../payables/InvoiceScreens').then((m) => m.SupplierInvoiceNewScreen),
            ),
            handle: back('pur.supplier_invoice.create', 'supplierInvoiceNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../payables/InvoiceScreens').then((m) => m.SupplierInvoiceScreen),
            ),
            handle: back('pur.supplier_invoice.read', 'supplierInvoice'),
          },
        ],
      },
      {
        path: 'supplier-payments',
        handle: back('pur.supplier_payment.read', 'supplierPayments'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../payables/PaymentScreens').then((m) => m.SupplierPaymentsScreen),
            ),
            handle: back('pur.supplier_payment.read', 'supplierPayments'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../payables/PaymentScreens').then((m) => m.SupplierPaymentNewScreen),
            ),
            handle: back('pur.supplier_payment.create', 'supplierPaymentNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../payables/PaymentScreens').then((m) => m.SupplierPaymentScreen),
            ),
            handle: back('pur.supplier_payment.read', 'supplierPayment'),
          },
        ],
      },
      {
        path: 'supplier-claims/:id',
        element: lazyScreen(() =>
          import('../payables/ClaimScreen').then((m) => m.SupplierClaimScreen),
        ),
        handle: back('pur.supplier_invoice.read', 'supplierClaim'),
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
        handle: back('mdm.supplier.read', 'suppliers'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../lists/ListScreens').then((m) => m.SuppliersScreen),
            ),
            handle: back('mdm.supplier.read', 'suppliers'),
          },
          {
            // F10g: what is owed to the supplier, claimed from it and paid to it.
            path: ':id',
            element: lazyScreen(() =>
              import('../payables/SupplierAccountScreen').then((m) => m.SupplierAccountScreen),
            ),
            handle: back('pur.supplier_invoice.read', 'supplierAccount'),
          },
        ],
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
      // F6, loaded on demand (ADR 0032). Livestock: each leaf's permission is the x-permission of its read.
      {
        path: 'animals',
        handle: back('liv.animal.read', 'animals'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../livestock/AnimalsScreen').then((m) => m.AnimalsScreen),
            ),
            handle: back('liv.animal.read', 'animals'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../livestock/AnimalScreen').then((m) => m.AnimalScreen),
            ),
            handle: back('liv.animal.read', 'animal'),
          },
        ],
      },
      {
        path: 'weights',
        element: lazyScreen(() =>
          import('../livestock/WeightsScreen').then((m) => m.WeightsScreen),
        ),
        handle: back('liv.weight.read', 'weights'),
      },
      {
        path: 'health-events',
        handle: back('liv.health.read', 'healthEvents'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../livestock/HealthScreens').then((m) => m.HealthEventsScreen),
            ),
            handle: back('liv.health.read', 'healthEvents'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../livestock/HealthScreens').then((m) => m.HealthEventScreen),
            ),
            handle: back('liv.health.read', 'healthEvent'),
          },
        ],
      },
      {
        path: 'breeding',
        handle: back('liv.breeding.read', 'breeding'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../livestock/BreedingScreens').then((m) => m.BreedingScreen),
            ),
            handle: back('liv.breeding.read', 'breeding'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../livestock/BreedingScreens').then((m) => m.BreedingRecordScreen),
            ),
            handle: back('liv.breeding.read', 'breedingRecord'),
          },
        ],
      },
      {
        path: 'mortality',
        handle: back('liv.mortality.read', 'mortality'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../livestock/MortalityScreens').then((m) => m.MortalityScreen),
            ),
            handle: back('liv.mortality.read', 'mortality'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../livestock/MortalityScreens').then((m) => m.MortalityRecordScreen),
            ),
            handle: back('liv.mortality.read', 'mortalityRecord'),
          },
        ],
      },
      // F6b: the approvals inbox, and one request with its evidence.
      {
        path: 'approvals',
        handle: back('iam.approval.read', 'approvals'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../approvals/ApprovalsScreen').then((m) => m.ApprovalsScreen),
            ),
            handle: back('iam.approval.read', 'approvals'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../approvals/ApprovalScreen').then((m) => m.ApprovalScreen),
            ),
            handle: back('iam.approval.read', 'approvals'),
          },
        ],
      },
      // F6b: the reporter of a death sends it from here, whether or not they can read the records.
      {
        path: 'report-death',
        element: lazyScreen(() =>
          import('../livestock/ReportDeathScreen').then((m) => m.ReportDeathScreen),
        ),
        handle: back('liv.mortality.report', 'reportDeath'),
      },
      {
        path: 'feed',
        element: lazyScreen(() => import('../livestock/FeedScreen').then((m) => m.FeedScreen)),
        handle: back('liv.feed.read', 'feed'),
      },
      // F6, processing.
      {
        path: 'processing-orders',
        handle: back('prc.order.read', 'processingOrders'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../processing/ProcessingOrdersScreen').then((m) => m.ProcessingOrdersScreen),
            ),
            handle: back('prc.order.read', 'processingOrders'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../processing/NewProcessingOrderScreen').then(
                (m) => m.NewProcessingOrderScreen,
              ),
            ),
            handle: back('prc.order.create', 'processingOrderNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../processing/ProcessingOrderScreen').then((m) => m.ProcessingOrderScreen),
            ),
            handle: back('prc.order.read', 'processingOrder'),
          },
        ],
      },
      {
        path: 'yield-standards',
        element: lazyScreen(() =>
          import('../processing/YieldStandardsScreen').then((m) => m.YieldStandardsScreen),
        ),
        handle: back('prc.yield_standard.read', 'yieldStandards'),
      },
      // F8: invoices, receipts, credit and debit notes, the document viewer and reprints; statements.
      {
        path: 'billing-documents',
        handle: back('bil.document.read', 'billingDocuments'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../billing/BillingDocumentsScreen').then((m) => m.BillingDocumentsScreen),
            ),
            handle: back('bil.document.read', 'billingDocuments'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../billing/BillingDocumentScreen').then((m) => m.BillingDocumentScreen),
            ),
            handle: back('bil.document.read', 'billingDocument'),
          },
          {
            path: ':id/credit-note',
            element: lazyScreen(() =>
              import('../billing/CreditNoteScreen').then((m) => m.CreditNoteScreen),
            ),
            handle: back('bil.credit_note.create', 'creditNote'),
          },
          {
            path: ':id/debit-note',
            element: lazyScreen(() =>
              import('../billing/DebitNoteScreen').then((m) => m.DebitNoteScreen),
            ),
            handle: back('bil.debit_note.create', 'debitNote'),
          },
        ],
      },
      {
        path: 'statements',
        handle: back('whl.statement.read', 'statements'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../billing/StatementScreens').then((m) => m.StatementsScreen),
            ),
            handle: back('whl.statement.read', 'statements'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../billing/StatementScreens').then((m) => m.StatementNewScreen),
            ),
            handle: back('whl.statement.create', 'statementNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../billing/StatementScreens').then((m) => m.StatementScreen),
            ),
            handle: back('whl.statement.read', 'statement'),
          },
        ],
      },
      {
        path: 'orders',
        handle: back('ord.order.read', 'orders'),
        children: [
          {
            // F11: every channel's orders in one list.
            index: true,
            element: lazyScreen(() =>
              import('../fulfilment/OrderScreens').then((m) => m.OrdersScreen),
            ),
            handle: back('ord.order.read', 'orders'),
          },
          {
            // F11: the order's picking, consent and delivery. `:id` stays F10i's page (its payment and
            // credit), so the two lanes never edit one screen.
            path: ':id/fulfilment',
            element: lazyScreen(() =>
              import('../fulfilment/OrderScreens').then((m) => m.OrderFulfilmentScreen),
            ),
            handle: back('ord.order.read', 'orderFulfilment'),
          },
          {
            // F10i: an order made from a quote, where a credit order's credit is checked.
            path: ':id',
            element: lazyScreen(() =>
              import('../wholesale/OrderScreen').then((m) => m.OrderScreen),
            ),
            handle: back('ord.order.read', 'order'),
          },
        ],
      },
      // F11: picking, dispatch and the delivery runs, loaded on demand (ADR 0032).
      {
        path: 'fulfilments',
        handle: back('ord.fulfilment.read', 'fulfilments'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../fulfilment/PickScreens').then((m) => m.FulfilmentsScreen),
            ),
            handle: back('ord.fulfilment.read', 'fulfilments'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../fulfilment/PickScreens').then((m) => m.PickScreen),
            ),
            handle: back('ord.fulfilment.read', 'fulfilment'),
          },
        ],
      },
      {
        path: 'deliveries',
        element: lazyScreen(() =>
          import('../fulfilment/DispatchScreens').then((m) => m.DeliveriesScreen),
        ),
        handle: back('del.delivery.read', 'deliveries'),
      },
      {
        path: 'routes',
        handle: back('del.route.read', 'routes'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../fulfilment/DispatchScreens').then((m) => m.RoutesScreen),
            ),
            handle: back('del.route.read', 'routes'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../fulfilment/DispatchScreens').then((m) => m.RouteScreen),
            ),
            handle: back('del.route.read', 'route'),
          },
        ],
      },
      // F10i: quotes, requests for quote, wholesale accounts and ageing, loaded on demand (ADR 0032).
      {
        path: 'quotes',
        handle: back('quo.quote.read', 'quotes'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../wholesale/QuoteScreens').then((m) => m.QuotesScreen),
            ),
            handle: back('quo.quote.read', 'quotes'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../wholesale/QuoteScreens').then((m) => m.QuoteNewScreen),
            ),
            handle: back('quo.quote.create', 'quoteNew'),
          },
          {
            path: ':id',
            element: lazyScreen(() =>
              import('../wholesale/QuoteScreens').then((m) => m.QuoteScreen),
            ),
            handle: back('quo.quote.read', 'quote'),
          },
        ],
      },
      {
        path: 'rfqs',
        handle: back('quo.rfq.read', 'rfqs'),
        children: [
          {
            index: true,
            element: lazyScreen(() => import('../wholesale/RfqScreens').then((m) => m.RfqsScreen)),
            handle: back('quo.rfq.read', 'rfqs'),
          },
          {
            path: ':id',
            element: lazyScreen(() => import('../wholesale/RfqScreens').then((m) => m.RfqScreen)),
            handle: back('quo.rfq.read', 'rfq'),
          },
        ],
      },
      {
        path: 'business-accounts',
        handle: back('whl.account.read', 'businessAccounts'),
        children: [
          {
            index: true,
            element: lazyScreen(() =>
              import('../wholesale/AccountScreens').then((m) => m.BusinessAccountsScreen),
            ),
            handle: back('whl.account.read', 'businessAccounts'),
          },
          {
            path: 'new',
            element: lazyScreen(() =>
              import('../wholesale/AccountScreens').then((m) => m.BusinessAccountNewScreen),
            ),
            handle: back('whl.account.manage', 'businessAccountNew'),
          },
          {
            path: ':customerId',
            element: lazyScreen(() =>
              import('../wholesale/AccountScreens').then((m) => m.BusinessAccountScreen),
            ),
            handle: back('whl.account.read', 'businessAccount'),
          },
        ],
      },
      {
        path: 'ageing',
        element: lazyScreen(() => import('../wholesale/AgeingScreen').then((m) => m.AgeingScreen)),
        handle: back('whl.ageing.read', 'ageing'),
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
  {
    // F11: the driver's phone, in its own full-screen frame (ADR 0055). One chunk holds the frame and every
    // driver screen, so each opens later with no signal.
    path: 'driver',
    element: lazyScreen(() => import('../driver/DriverScreens').then((m) => m.DriverShell)),
    children: [
      {
        index: true,
        element: lazyScreen(() => import('../driver/DriverScreens').then((m) => m.DriverRunScreen)),
        handle: driver('driverRun'),
      },
      {
        path: 'cash',
        element: lazyScreen(() =>
          import('../driver/DriverScreens').then((m) => m.DriverCashScreen),
        ),
        handle: driver('driverCash'),
      },
      {
        path: 'stops/:id',
        element: lazyScreen(() =>
          import('../driver/DriverScreens').then((m) => m.DriverStopScreen),
        ),
        handle: driver('driverStop'),
      },
      {
        path: 'stops/:id/delivered',
        element: lazyScreen(() =>
          import('../driver/DriverScreens').then((m) => m.DriverProofScreen),
        ),
        handle: driver('driverProof', 'del.proof.create'),
      },
      {
        path: 'stops/:id/not-delivered',
        element: lazyScreen(() =>
          import('../driver/DriverScreens').then((m) => m.DriverFailureScreen),
        ),
        handle: driver('driverFailure', 'del.delivery.update.assigned'),
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
