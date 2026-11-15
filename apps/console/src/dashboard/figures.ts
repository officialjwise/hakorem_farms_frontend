import type { components } from '@hakorem/api-client';

export type OwnerDashboard = components['schemas']['OwnerDashboard'];

/**
 * Every figure the dashboard shows, and where it comes from (owner, 2026-11-15: one call,
 * `getOwnerDashboard`, and a figure with no data source yet is shown as unavailable, never as zero).
 *
 * `field` names the `OwnerDashboard` field the figure reads, or is null when contract 1.17.0 does not carry
 * it yet. CR-013 asks for those fields and for the response's own list of figures with no data source;
 * when the contract carries them, wiring a figure is changing its line here. Nothing else decides whether a
 * tile shows a number.
 */
export const FIGURES = {
  salesToday: { field: 'salesTodayPesewas' },
  purchasesToday: { field: null },
  stockValue: { field: 'stockValueAtCostPesewas' },
  receivables: { field: 'receivablesOutstandingPesewas' },
  lowStock: { field: null },
  animalsOnHand: { field: null },
  series: { field: null },
  salesMonthToDate: { field: 'salesMonthToDatePesewas' },
  purchasesPeriod: { field: null },
  stockHealth: { field: null },
  stockByCategory: { field: null },
  stockAlerts: { field: null },
  expiringLots: { field: null },
  expiredLots: { field: null },
  nearExpiry: { field: null },
  invoices: { field: null },
  recentPayments: { field: null },
  paymentSplit: { field: null },
  salesByChannel: { field: 'salesByChannel' },
  cash: { field: 'cash' },
  topMovers: { field: 'topMovers' },
  alerts: { field: 'alerts' },
  exceptionsToday: { field: 'exceptionsToday' },
} as const satisfies Record<string, { field: keyof OwnerDashboard | null }>;

export type FigureKey = keyof typeof FIGURES;

/** Whether the response can carry this figure. A figure that cannot is shown as unavailable. */
export function isAvailable(key: FigureKey): boolean {
  return FIGURES[key].field !== null;
}

/** The figures shown as unavailable, for the report and the tests. */
export const UNAVAILABLE: readonly FigureKey[] = (Object.keys(FIGURES) as FigureKey[]).filter(
  (key) => !isAvailable(key),
);
