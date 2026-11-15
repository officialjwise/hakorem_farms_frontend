import { describe, expect, it } from 'vitest';
import { placesFor, toQuantity } from './units';

describe('toQuantity', () => {
  it('pads what was typed to the contract’s three places, as a string', () => {
    expect(toQuantity('34')).toBe('34.000');
    expect(toQuantity('29.75')).toBe('29.750');
    expect(toQuantity('0.125')).toBe('0.125');
    expect(toQuantity('7.')).toBe('7.000');
    expect(toQuantity('007')).toBe('7.000');
    expect(toQuantity('0')).toBe('0.000');
  });

  it('refuses anything that is not a quantity', () => {
    for (const bad of ['', '-1', '1.2345', 'abc', '1,5', '.5']) expect(toQuantity(bad)).toBeNull();
  });
});

describe('placesFor', () => {
  it('counts in whole numbers and weighs in three places, and an unknown unit shows three', () => {
    expect(placesFor('COUNT')).toBe(0);
    expect(placesFor('WEIGHT')).toBe(3);
    expect(placesFor('VOLUME')).toBe(3);
    expect(placesFor(undefined)).toBe(3);
  });
});
