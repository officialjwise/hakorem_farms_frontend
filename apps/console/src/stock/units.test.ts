import { describe, expect, it } from 'vitest';
import { asPlaces, compareQuantity, toQuantity } from './units';

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

describe('asPlaces', () => {
  it('takes the unit’s declared precision, and shows three places when it is missing or out of range', () => {
    expect(asPlaces(0)).toBe(0);
    expect(asPlaces(2)).toBe(2);
    expect(asPlaces(3)).toBe(3);
    expect(asPlaces(undefined)).toBe(3);
    expect(asPlaces(7)).toBe(3);
  });
});

describe('compareQuantity', () => {
  it('compares two contract quantities exactly, without arithmetic', () => {
    expect(compareQuantity('18.000', '20.000')).toBe(-1);
    expect(compareQuantity('20.000', '20.000')).toBe(0);
    expect(compareQuantity('20.001', '20.000')).toBe(1);
    expect(compareQuantity('9.999', '10.000')).toBe(-1);
    expect(compareQuantity('0.000', '0.000')).toBe(0);
  });
});
