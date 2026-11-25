/**
 * What the pick screen decides before it asks the server: how it may read the order (2.29.0), and whether
 * a quantity typed for a short pick is one the server takes (2.25.0). Quantities are compared as the API's
 * three-place strings; nothing is added up and no money is touched.
 */
import { compareQuantity, toQuantity } from '../stock/units';

/**
 * How the pick screen reads the order: `getOrder` with its money, the store's own view with none
 * (`getOrderFulfilmentView`, for the Storekeeper, who does not hold `ord.order.read`), or not at all.
 */
export type OrderRead = 'full' | 'store' | 'none';

export function orderReadFor(can: (permission: string) => boolean): OrderRead {
  if (can('ord.order.read')) return 'full';
  if (can('ord.order.read.fulfilment')) return 'store';
  return 'none';
}

export type ShortPickCheck =
  | { qty: string; error: null }
  | { qty: null; error: 'missing' | 'invalid' }
  | { qty: string; error: 'notLess' };

/**
 * The quantity typed for a short pick, as the contract's `Quantity`: at least nothing, and less than the
 * line ordered (`SHORT_NOT_LESS` otherwise). Whether it converts exactly is the server's to say.
 */
export function checkShortPick(typed: string, ordered: string): ShortPickCheck {
  const text = typed.trim();
  if (text === '') return { qty: null, error: 'missing' };
  const qty = toQuantity(text);
  if (qty === null) return { qty: null, error: 'invalid' };
  if (compareQuantity(qty, ordered) >= 0) return { qty, error: 'notLess' };
  return { qty, error: null };
}

/**
 * Whether a line may be offered short: an open line of an order being picked, counted rather than weighed
 * (a catch-weight line goes by its weight, `CATCH_WEIGHT_GOES_BY_WEIGHT`). While the order already waits
 * for the customer, one question is open and another is refused (`CONSENT_PENDING`).
 */
export function canProposeShort(
  orderStatus: string,
  lineStatus: string,
  estimatedWeightKg: string | null,
): boolean {
  return orderStatus === 'PICKING' && lineStatus === 'OPEN' && estimatedWeightKg === null;
}
