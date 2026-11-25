import { afterEach, describe, expect, it } from 'vitest';
import {
  cardRequestFor,
  forgetCardRequest,
  forgetStaleCardRequest,
  rememberCardRequest,
  type CardRequest,
} from './cardRequest';

const CHECKOUT = '019a7b20-1111-7000-8000-000000000001';
const OTHER = '019a7b20-2222-7000-8000-000000000002';
const REQUEST: CardRequest = {
  checkoutId: CHECKOUT,
  said: JSON.stringify({ paymentMethod: 'CARD' }),
  key: '019a7b20-3333-7000-8000-000000000003',
  notOpened: true,
};
const HOLD = '2026-11-25T10:15:00Z';
const BEFORE = Date.parse('2026-11-25T10:14:59Z');
const AT = Date.parse('2026-11-25T10:15:00Z');
const kept = () => window.sessionStorage.getItem('hk_card_request');

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("the card request kept for this tab's checkout (ADR 0060)", () => {
  it('keeps it in session storage only, never in local storage', () => {
    rememberCardRequest(REQUEST);
    expect(cardRequestFor(kept(), CHECKOUT)).toEqual(REQUEST);
    expect(window.localStorage.length).toBe(0);
  });

  it('is for one checkout only: another checkout reads nothing, and a new one replaces it', () => {
    rememberCardRequest(REQUEST);
    expect(cardRequestFor(kept(), OTHER)).toBeNull();
    rememberCardRequest({ ...REQUEST, checkoutId: OTHER });
    expect(cardRequestFor(kept(), CHECKOUT)).toBeNull();
    expect(cardRequestFor(kept(), OTHER)?.checkoutId).toBe(OTHER);
  });

  it('is cleared once the checkout’s hold, as the server reads it, has lapsed; kept until then', () => {
    rememberCardRequest(REQUEST);
    forgetStaleCardRequest(CHECKOUT, HOLD, BEFORE);
    expect(kept()).not.toBeNull();
    forgetStaleCardRequest(CHECKOUT, HOLD, AT);
    expect(kept()).toBeNull();
  });

  it('is cleared when another checkout is open in the tab', () => {
    rememberCardRequest(REQUEST);
    forgetStaleCardRequest(OTHER, HOLD, BEFORE);
    expect(kept()).toBeNull();
  });

  it('is cleared when the checkout is done with', () => {
    rememberCardRequest(REQUEST);
    forgetCardRequest();
    expect(kept()).toBeNull();
  });

  it('reads nothing that is not a card request of its own shape, and clears it', () => {
    for (const bad of [
      'not json',
      JSON.stringify({ ...REQUEST, key: 'not-a-uuid' }),
      JSON.stringify({ ...REQUEST, said: JSON.stringify({ paymentMethod: 'MOBILE_MONEY' }) }),
      JSON.stringify({ ...REQUEST, notOpened: 'yes' }),
    ]) {
      window.sessionStorage.setItem('hk_card_request', bad);
      expect(cardRequestFor(kept(), CHECKOUT)).toBeNull();
      forgetStaleCardRequest(CHECKOUT, HOLD, BEFORE);
      expect(kept()).toBeNull();
    }
  });
});
