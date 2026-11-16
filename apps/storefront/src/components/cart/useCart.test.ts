import { describe, expect, it } from 'vitest';
import { toQuantity, toUnits } from './useCart';

describe('cart quantities are whole units (contract 1.32.0)', () => {
  it('writes whole units in the contract’s Quantity form, and reads them back', () => {
    expect(toQuantity(2)).toBe('2.000');
    expect(toUnits('2.000')).toBe(2);
    expect(toUnits(toQuantity(37))).toBe(37);
  });

  it('refuses a fraction or a negative, rather than rounding it', () => {
    expect(() => toQuantity(1.5)).toThrow(RangeError);
    expect(() => toQuantity(-1)).toThrow(RangeError);
  });
});
