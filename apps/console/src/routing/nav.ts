import {
  Boxes,
  BadgeCent,
  ClipboardCheck,
  ArrowLeftRight,
  PackagePlus,
  SlidersHorizontal,
  FolderTree,
  Ruler,
  PawPrint,
  LayoutDashboard,
  MonitorSmartphone,
  ScanBarcode,
  ScrollText,
  ShieldCheck,
  ShoppingBasket,
  Tag,
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

/** The back office sidebar. Orders is a placeholder until its own session builds it. */
export const BACK_OFFICE_NAV: readonly NavItem[] = [
  { key: 'dashboard', path: '/', permission: null, icon: LayoutDashboard },
  { key: 'stock', path: '/stock', permission: 'inv.stock.read', icon: Boxes },
  {
    key: 'stockTakes',
    path: '/stock-takes',
    permission: 'inv.stock_take.read',
    icon: ClipboardCheck,
  },
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
  { key: 'products', path: '/products', permission: 'mdm.product.read', icon: Tag },
  { key: 'categories', path: '/categories', permission: 'mdm.category.read', icon: FolderTree },
  { key: 'units', path: '/units', permission: 'mdm.product.read', icon: Ruler },
  { key: 'species', path: '/species', permission: 'mdm.species.read', icon: PawPrint },
  { key: 'priceLists', path: '/price-lists', permission: 'mdm.price_list.read', icon: BadgeCent },
  { key: 'orders', path: '/orders', permission: 'ord.order.read', icon: ShoppingBasket },
  { key: 'users', path: '/users', permission: 'iam.user.read', icon: Users },
  { key: 'roles', path: '/roles', permission: 'iam.role.read', icon: ShieldCheck },
  { key: 'sessions', path: '/sessions', permission: 'iam.session.read', icon: MonitorSmartphone },
  { key: 'audit', path: '/audit', permission: 'aud.audit.read', icon: ScrollText },
];

export const POS_NAV: NavItem = {
  key: 'pos',
  path: '/pos',
  permission: 'pos.sale.create',
  icon: ScanBarcode,
};
