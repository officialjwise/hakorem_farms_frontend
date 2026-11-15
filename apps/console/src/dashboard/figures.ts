import type { components } from '@hakorem/api-client';

export type OwnerDashboard = components['schemas']['OwnerDashboard'];

/**
 * Every figure the dashboard shows, and where it comes from (owner, 2026-11-15: one call,
 * `getOwnerDashboard`, and a figure with no data source yet is shown as unavailable, never as zero).
 *
 * `field` names the `OwnerDashboard` field the figure reads, or is null when the contract does not carry it
 * at all (the further CR-013 figures, BL-050). A field the contract carries can still be null while its
 * source is unbuilt: the response lists it in `pendingFigures` (1.21.0), and the screen asks `isAvailable`
 * with the response, so a figure appears the day the server sends it, with no change here.
 */
export const FIGURES = {
  salesToday: { field: 'salesTodayPesewas' },
  salesSeries: { field: 'salesSeries' },
  salesMonthToDate: { field: 'salesMonthToDatePesewas' },
  purchasesToday: { field: 'purchasesTodayPesewas' },
  purchasesSeries: { field: 'purchases' },
  stockValue: { field: 'stockValueAtCostPesewas' },
  lowStock: { field: 'lowStockCount' },
  animalsOnHand: { field: 'animalsOnHand' },
  receivables: { field: 'receivablesOutstandingPesewas' },
  cash: { field: 'cash' },
  salesByChannel: { field: 'salesByChannel' },
  topMovers: { field: 'topMovers' },
  alerts: { field: 'alerts' },
  exceptionsToday: { field: 'exceptionsToday' },
  stockHealth: { field: null },
  stockByCategory: { field: null },
  stockAlerts: { field: null },
  expiringLots: { field: null },
  expiredLots: { field: null },
  nearExpiry: { field: null },
  invoices: { field: null },
  recentPayments: { field: null },
  paymentSplit: { field: null },
} as const satisfies Record<string, { field: keyof OwnerDashboard | null }>;

export type FigureKey = keyof typeof FIGURES;

/** The figures the contract does not carry at all: unavailable whatever the server answers. */
export const NOT_IN_CONTRACT: readonly FigureKey[] = (Object.keys(FIGURES) as FigureKey[]).filter(
  (key) => FIGURES[key].field === null,
);

/**
 * Whether this response carries the figure: the contract has its field and the server has not listed it in
 * `pendingFigures`. A figure that is not available is named in the pending strip, never shown as zero.
 */
export function isAvailable(key: FigureKey, dashboard: OwnerDashboard): boolean {
  const field = FIGURES[key].field;
  if (field === null) return false;
  if (dashboard.pendingFigures.some((pending) => pending.figure === field)) return false;
  return dashboard[field] !== null;
}

/** Every figure this response does not carry, in the order the screen names them. */
export function unavailable(dashboard: OwnerDashboard): FigureKey[] {
  return (Object.keys(FIGURES) as FigureKey[]).filter((key) => !isAvailable(key, dashboard));
}
