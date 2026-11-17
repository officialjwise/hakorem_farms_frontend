import { describe, expect, it } from 'vitest';
import { openCheckoutId } from './cartId';

describe('openCheckoutId (CR-029)', () => {
  const id = '019a7b40-2c1d-7e8f-9a0b-1c2d3e4f5a6b';

  it("is the cart's own checkout while it is at checkout, so another tab or device opens the same one", () => {
    expect(openCheckoutId({ status: 'CHECKOUT', checkoutId: id })).toBe(id);
  });

  it('is none for a cart in any other status, whatever it says', () => {
    for (const status of ['ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED']) {
      expect(openCheckoutId({ status, checkoutId: id })).toBeNull();
    }
    expect(openCheckoutId({ status: 'CHECKOUT', checkoutId: null })).toBeNull();
  });

  it('is none before the cart has loaded', () => {
    expect(openCheckoutId(undefined)).toBeNull();
  });
});
