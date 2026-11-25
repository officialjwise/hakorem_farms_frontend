import { describe, expect, it } from 'vitest';
import { orderReadFor } from './pickRules';

const holding =
  (...held: string[]) =>
  (permission: string) =>
    held.includes(permission);

describe('how the pick screen reads the order (2.29.0)', () => {
  it('reads the whole order for someone who holds ord.order.read', () => {
    expect(orderReadFor(holding('ord.order.read', 'ord.order.read.fulfilment'))).toBe('full');
    expect(orderReadFor(holding('ord.order.read'))).toBe('full');
  });

  it('reads the store’s view, with no money, for the Storekeeper', () => {
    expect(orderReadFor(holding('ord.fulfilment.pick', 'ord.order.read.fulfilment'))).toBe('store');
  });

  it('reads nothing without either permission', () => {
    expect(orderReadFor(holding('ord.fulfilment.pick'))).toBe('none');
  });
});
