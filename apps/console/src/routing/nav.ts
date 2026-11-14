import {
  Boxes,
  LayoutDashboard,
  ScanBarcode,
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

/** The back office sidebar. Each destination here is a placeholder until its own session builds the screen. */
export const BACK_OFFICE_NAV: readonly NavItem[] = [
  { key: 'dashboard', path: '/', permission: null, icon: LayoutDashboard },
  { key: 'stock', path: '/stock', permission: 'inv.stock.read', icon: Boxes },
  { key: 'products', path: '/products', permission: 'mdm.product.read', icon: Tag },
  { key: 'orders', path: '/orders', permission: 'ord.order.read', icon: ShoppingBasket },
  { key: 'users', path: '/users', permission: 'iam.user.read', icon: Users },
];

export const POS_NAV: NavItem = {
  key: 'pos',
  path: '/pos',
  permission: 'pos.sale.create',
  icon: ScanBarcode,
};
