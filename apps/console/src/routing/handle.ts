/**
 * What every console route declares about itself, through react-router's `handle`.
 *
 * `permission` is mandatory on every route behind sign-in (a permission code from the contract's
 * `x-permission`, or `null` for "any signed-in user"). A route that declares nothing is treated as denied,
 * so forgetting is safe, and a unit test walks the route tree so forgetting is also caught.
 */
export interface RouteHandle {
  /** The permission code the route needs, or null when any signed-in user may open it. */
  permission: string | null;
  /** Which shell the route renders in. Decides density, theme default and chrome. */
  shell: 'back-office' | 'pos';
  /** Key into the `shell` namespace's `nav` group, used for the page title and the breadcrumb. */
  crumb: NavKey;
}

export type NavKey =
  | 'dashboard'
  | 'stock'
  | 'products'
  | 'orders'
  | 'users'
  | 'roles'
  | 'sessions'
  | 'audit'
  | 'pos'
  | 'posSetup'
  | 'posShiftOpen'
  | 'posShift'
  | 'posQueue'
  | 'posReturns'
  | 'userNew'
  | 'userDetail'
  | 'roleNew'
  | 'roleDetail'
  | 'auditEvent'
  | 'productNew'
  | 'productDetail'
  | 'categories'
  | 'units'
  | 'species'
  | 'speciesDetail'
  | 'priceLists'
  | 'priceListDetail'
  | 'priceListVersion'
  | 'animals'
  | 'animal'
  | 'weights'
  | 'healthEvents'
  | 'healthEvent'
  | 'breeding'
  | 'breedingRecord'
  | 'mortality'
  | 'reportDeath'
  | 'approvals'
  | 'mortalityRecord'
  | 'feed'
  | 'processingOrders'
  | 'processingOrderNew'
  | 'processingOrder'
  | 'yieldStandards'
  | 'stockTakes'
  | 'stockTake'
  | 'adjustments'
  | 'adjustmentNew'
  | 'adjustment'
  | 'transfers'
  | 'transferNew'
  | 'transfer'
  | 'receipts'
  | 'receiptNew'
  | 'receipt'
  | 'branches'
  | 'branchNew'
  | 'branchDetail'
  | 'labels'
  | 'lots'
  | 'movements'
  | 'suppliers'
  | 'registers'
  | 'reports'
  | 'report'
  | 'settings'
  | 'settingsBusiness'
  | 'settingsSystem'
  | 'billingDocuments'
  | 'billingDocument'
  | 'creditNote'
  | 'debitNote'
  | 'statements'
  | 'statement'
  | 'statementNew';

export function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'permission' in value &&
    (typeof value.permission === 'string' || value.permission === null)
  );
}
