import {
  ArrowLeftRight,
  BadgeCent,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FolderTree,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  PackagePlus,
  PawPrint,
  Printer,
  Ruler,
  ScanBarcode,
  ScrollText,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Store,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { NavKey } from './handle';

export interface NavItem {
  key: NavKey;
  path: string;
  /** The permission the destination needs. The item is offered only to users who hold it. */
  permission: string | null;
  icon: LucideIcon;
}

export type NavGroupKey = 'overview' | 'selling' | 'stock' | 'catalogue' | 'business' | 'people';

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
 * The back office sidebar, grouped by the job a person is doing (F5b). Orders is a placeholder until its
 * own session builds it.
 */
export const BACK_OFFICE_GROUPS: readonly NavGroup[] = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', path: '/', permission: null, icon: LayoutDashboard }],
  },
  {
    key: 'selling',
    items: [
      POS_NAV,
      { key: 'orders', path: '/orders', permission: 'ord.order.read', icon: ShoppingBasket },
      { key: 'registers', path: '/registers', permission: 'pos.register.read', icon: Store },
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
    ],
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
];

/** Every sidebar destination in one list, in sidebar order. */
export const BACK_OFFICE_NAV: readonly NavItem[] = BACK_OFFICE_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.key !== 'pos'),
);
