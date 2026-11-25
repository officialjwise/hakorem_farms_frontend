/**
 * What the pick screen decides before it asks the server: how it may read the order (2.29.0).
 */

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
