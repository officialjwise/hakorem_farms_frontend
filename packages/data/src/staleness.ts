/**
 * How long a successful answer counts as fresh, by class of data (ADR 0022, docs/DATA_CONVENTIONS.md).
 * The default is `live`: a screen opts into a longer class by saying which, never by omission, because a
 * stock figure or a balance that is quietly 30 seconds old is how a counter sells what is not there.
 */
export const STALE_TIME_MS = {
  /** Money, stock, shifts, approvals, anything an operator acts on: refetch whenever a screen mounts or the window regains focus. */
  live: 0,
  /** Lists people browse and filter (products, customers, orders): 30 seconds. Never for a figure someone will act on. */
  working: 30_000,
  /** Reference data that changes rarely (units, categories, tax categories, grades, roles): 10 minutes. */
  reference: 10 * 60_000,
  /** Records that cannot change once written (an issued document, a closed period): never stale. */
  immutable: Infinity,
} as const;

export type StaleClass = keyof typeof STALE_TIME_MS;

export const DEFAULT_STALE_CLASS: StaleClass = 'live';
