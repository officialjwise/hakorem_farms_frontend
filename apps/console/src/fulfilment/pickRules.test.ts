import { describe, expect, it } from 'vitest';
import { canProposeShort, checkShortPick, orderReadFor } from './pickRules';

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

describe('a short pick’s quantity (2.25.0)', () => {
  it('takes less than was ordered, as the contract’s quantity', () => {
    expect(checkShortPick('11', '12.000')).toEqual({ qty: '11.000', error: null });
    expect(checkShortPick(' 2.5 ', '12.000')).toEqual({ qty: '2.500', error: null });
  });

  it('takes nothing at all: the customer may agree to none', () => {
    expect(checkShortPick('0', '12.000')).toEqual({ qty: '0.000', error: null });
  });

  it('refuses the full quantity or more, as the server does (SHORT_NOT_LESS)', () => {
    expect(checkShortPick('12', '12.000')).toEqual({ qty: '12.000', error: 'notLess' });
    expect(checkShortPick('13', '12.000')).toEqual({ qty: '13.000', error: 'notLess' });
  });

  it('says what is missing or not a number', () => {
    expect(checkShortPick('  ', '12.000')).toEqual({ qty: null, error: 'missing' });
    expect(checkShortPick('eleven', '12.000')).toEqual({ qty: null, error: 'invalid' });
    expect(checkShortPick('-1', '12.000')).toEqual({ qty: null, error: 'invalid' });
    expect(checkShortPick('1.2345', '12.000')).toEqual({ qty: null, error: 'invalid' });
  });
});

describe('which lines may be offered short', () => {
  it('offers an open, counted line of an order being picked', () => {
    expect(canProposeShort('PICKING', 'OPEN', null)).toBe(true);
  });

  it('does not offer a catch-weight line, which goes by its weight', () => {
    expect(canProposeShort('PICKING', 'OPEN', '30.000')).toBe(false);
  });

  it('does not offer one while the order already waits for the customer', () => {
    expect(canProposeShort('AWAITING_CUSTOMER', 'OPEN', null)).toBe(false);
  });

  it('does not offer a line already picked, substituted or cancelled', () => {
    expect(canProposeShort('PICKING', 'FULFILLED', null)).toBe(false);
    expect(canProposeShort('PICKING', 'CANCELLED', null)).toBe(false);
  });
});
