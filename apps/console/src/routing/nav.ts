import {
  ArrowLeftRight,
  Banknote,
  Beef,
  HeartCrack,
  HeartPulse,
  Percent,
  Scale,
  Syringe,
  Wheat,
  BadgeCent,
  BookText,
  Receipt,
  ChartColumn,
  Boxes,
  Building,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  FolderTree,
  History,
  Hourglass,
  Inbox,
  LayoutDashboard,
  Stamp,
  MonitorSmartphone,
  PackagePlus,
  PawPrint,
  Printer,
  Ruler,
  ScanBarcode,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Store,
  Tag,
  Truck,
  Users,
  type LucideIcon,
  PackageCheck,
  Route as RouteIcon,
  Smartphone,
} from 'lucide-react';
import type { NavKey } from './handle';

export interface NavItem {
  key: NavKey;
  path: string;
  /** The permission the destination needs. The item is offered only to users who hold it. */
  permission: string | null;
  icon: LucideIcon;
}

export type NavGroupKey =
  | 'overview'
  | 'selling'
  | 'billing'
  | 'stock'
  | 'livestock'
  | 'processing'
  | 'catalogue'
  | 'business'
  | 'reports'
  | 'people'
  | 'settings';

export interface NavGroup {
  key: NavGroupKey;
  items: readonly NavItem[];
}

export const POS_NAV: NavItem = {
  key: 'pos',
  path: '/pos',
  permission: 'pos.sale.create',
  icon: ScanBarcode,
};

/**
 * The back office sidebar, grouped by the job a person is doing (F5b).
 */
export const BACK_OFFICE_GROUPS: readonly NavGroup[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', path: '/', permission: null, icon: LayoutDashboard },
      // F6b: what waits on a second person, whichever module asked.
      { key: 'approvals', path: '/approvals', permission: 'iam.approval.read', icon: Stamp },
    ],
  },
  {
    key: 'selling',
    items: [
      POS_NAV,
      { key: 'orders', path: '/orders', permission: 'ord.order.read', icon: ShoppingBasket },
      // F11: picking, dispatch and the runs; and the driver's own run, on a phone.
      {
        key: 'fulfilments',
        path: '/fulfilments',
        permission: 'ord.fulfilment.read',
        icon: PackageCheck,
      },
      { key: 'deliveries', path: '/deliveries', permission: 'del.delivery.read', icon: Truck },
      { key: 'routes', path: '/routes', permission: 'del.route.read', icon: RouteIcon },
      {
        key: 'driverRun',
        path: '/driver',
        permission: 'del.delivery.read.assigned',
        icon: Smartphone,
      },
      { key: 'rfqs', path: '/rfqs', permission: 'quo.rfq.read', icon: Inbox },
      { key: 'quotes', path: '/quotes', permission: 'quo.quote.read', icon: FileSignature },
      {
        key: 'businessAccounts',
        path: '/business-accounts',
        permission: 'whl.account.read',
        icon: Building,
      },
      { key: 'registers', path: '/registers', permission: 'pos.register.read', icon: Store },
    ],
  },
  {
    // F8: what the customer was charged, and what they owe.
    key: 'billing',
    items: [
      {
        key: 'billingDocuments',
        path: '/billing-documents',
        permission: 'bil.document.read',
        icon: Receipt,
      },
      { key: 'statements', path: '/statements', permission: 'whl.statement.read', icon: BookText },
      { key: 'ageing', path: '/ageing', permission: 'whl.ageing.read', icon: Hourglass },
    ],
  },
  {
    key: 'stock',
    items: [
      { key: 'stock', path: '/stock', permission: 'inv.stock.read', icon: Boxes },
      { key: 'lots', path: '/lots', permission: 'inv.stock.read', icon: CalendarClock },
      {
        key: 'receipts',
        path: '/goods-receipts',
        permission: 'inv.goods_receipt.read',
        icon: PackagePlus,
      },
      {
        key: 'transfers',
        path: '/stock-transfers',
        permission: 'inv.transfer.read',
        icon: ArrowLeftRight,
      },
      {
        key: 'adjustments',
        path: '/stock-adjustments',
        permission: 'inv.adjustment.read',
        icon: SlidersHorizontal,
      },
      {
        key: 'stockTakes',
        path: '/stock-takes',
        permission: 'inv.stock_take.read',
        icon: ClipboardCheck,
      },
      { key: 'movements', path: '/movements', permission: 'inv.movement.read', icon: History },
      { key: 'labels', path: '/labels', permission: 'mdm.product.read', icon: Printer },
    ],
  },
  {
    // F6: the animals themselves and what happens to them, then turning them into meat.
    key: 'livestock',
    items: [
      { key: 'animals', path: '/animals', permission: 'liv.animal.read', icon: PawPrint },
      { key: 'weights', path: '/weights', permission: 'liv.weight.read', icon: Scale },
      {
        key: 'healthEvents',
        path: '/health-events',
        permission: 'liv.health.read',
        icon: Syringe,
      },
      { key: 'breeding', path: '/breeding', permission: 'liv.breeding.read', icon: HeartPulse },
      { key: 'mortality', path: '/mortality', permission: 'liv.mortality.read', icon: HeartCrack },
      {
        key: 'reportDeath',
        path: '/report-death',
        permission: 'liv.mortality.report',
        icon: HeartCrack,
      },
      { key: 'feed', path: '/feed', permission: 'liv.feed.read', icon: Wheat },
    ],
  },
  {
    key: 'processing',
    items: [
      {
        key: 'processingOrders',
        path: '/processing-orders',
        permission: 'prc.order.read',
        icon: Beef,
      },
      {
        key: 'yieldStandards',
        path: '/yield-standards',
        permission: 'prc.yield_standard.read',
        icon: Percent,
      },
    ],
  },
  {
    key: 'catalogue',
    items: [
      { key: 'products', path: '/products', permission: 'mdm.product.read', icon: Tag },
      { key: 'categories', path: '/categories', permission: 'mdm.category.read', icon: FolderTree },
      { key: 'units', path: '/units', permission: 'mdm.product.read', icon: Ruler },
      { key: 'species', path: '/species', permission: 'mdm.species.read', icon: PawPrint },
      {
        key: 'priceLists',
        path: '/price-lists',
        permission: 'mdm.price_list.read',
        icon: BadgeCent,
      },
    ],
  },
  {
    key: 'business',
    items: [
      { key: 'branches', path: '/branches', permission: 'mdm.branch.read', icon: Building2 },
      { key: 'suppliers', path: '/suppliers', permission: 'mdm.supplier.read', icon: Truck },
      {
        key: 'purchaseOrders',
        path: '/purchase-orders',
        permission: 'pur.purchase_order.read',
        icon: ClipboardList,
      },
      {
        key: 'supplierInvoices',
        path: '/supplier-invoices',
        permission: 'pur.supplier_invoice.read',
        icon: FileText,
      },
      {
        key: 'supplierPayments',
        path: '/supplier-payments',
        permission: 'pur.supplier_payment.read',
        icon: Banknote,
      },
    ],
  },
  {
    key: 'reports',
    items: [{ key: 'reports', path: '/reports', permission: 'rpt.report.read', icon: ChartColumn }],
  },
  {
    key: 'people',
    items: [
      { key: 'users', path: '/users', permission: 'iam.user.read', icon: Users },
      { key: 'roles', path: '/roles', permission: 'iam.role.read', icon: ShieldCheck },
      {
        key: 'sessions',
        path: '/sessions',
        permission: 'iam.session.read',
        icon: MonitorSmartphone,
      },
      { key: 'audit', path: '/audit', permission: 'aud.audit.read', icon: ScrollText },
    ],
  },
  {
    key: 'settings',
    items: [{ key: 'settings', path: '/settings', permission: null, icon: Settings }],
  },
];

/** Every sidebar destination in one list, in sidebar order. */
export const BACK_OFFICE_NAV: readonly NavItem[] = BACK_OFFICE_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.key !== 'pos'),
);
