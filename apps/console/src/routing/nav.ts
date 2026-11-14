import {
  Boxes,
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

/** The back office sidebar. Stock, products and orders are placeholders until their own sessions build them. */
export const BACK_OFFICE_NAV: readonly NavItem[] = [
  { key: 'dashboard', path: '/', permission: null, icon: LayoutDashboard },
  { key: 'stock', path: '/stock', permission: 'inv.stock.read', icon: Boxes },
  { key: 'products', path: '/products', permission: 'mdm.product.read', icon: Tag },
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
