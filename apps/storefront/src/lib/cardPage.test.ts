import { describe, expect, it } from 'vitest';
import { cardPageNotOpened, cardPageUrl } from './cardPage';

describe('cardPageUrl', () => {
  it('takes the card provider page on https://checkout.paystack.com/', () => {
    expect(cardPageUrl('https://checkout.paystack.com/0peioxfhpn2f4h1')).toBe(
      'https://checkout.paystack.com/0peioxfhpn2f4h1',
    );
    expect(cardPageUrl('https://checkout.paystack.com/abc?reference=SO-2026#card')).toBe(
      'https://checkout.paystack.com/abc?reference=SO-2026#card',
    );
  });

  it('refuses no address at all', () => {
    expect(cardPageUrl(null)).toBeNull();
    expect(cardPageUrl(undefined)).toBeNull();
    expect(cardPageUrl('')).toBeNull();
  });

  it('refuses any other host, even one that looks like it', () => {
    expect(cardPageUrl('https://evil.example/pay')).toBeNull();
    expect(cardPageUrl('https://paystack.com/pay')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.co/abc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com.evil.example/abc')).toBeNull();
    expect(cardPageUrl('https://evil.checkout.paystack.com/abc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com@evil.example/abc')).toBeNull();
    expect(cardPageUrl('https://checkout-paystack.com/abc')).toBeNull();
  });

  it('refuses another scheme, a port, a user name, or the bare origin with no path', () => {
    expect(cardPageUrl('http://checkout.paystack.com/abc')).toBeNull();
    expect(cardPageUrl('javascript:alert(1)//https://checkout.paystack.com/')).toBeNull();
    expect(cardPageUrl('//checkout.paystack.com/abc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com:8443/abc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com')).toBeNull();
    expect(cardPageUrl('HTTPS://CHECKOUT.PAYSTACK.COM/abc')).toBeNull();
  });

  it('refuses an address with spaces, tabs, line breaks or backslashes in it', () => {
    expect(cardPageUrl(' https://checkout.paystack.com/abc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com/a\tbc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com/a\nbc')).toBeNull();
    expect(cardPageUrl('https://checkout.paystack.com/\\evil.example')).toBeNull();
  });
});

describe('cardPageNotOpened', () => {
  const unavailable = { status: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE' };

  it('is the card placement answered 503 PAYMENT_PROVIDER_UNAVAILABLE: the order is placed', () => {
    expect(cardPageNotOpened('CARD', unavailable)).toBe(true);
  });

  it('is not any other method, status or code: nothing was placed', () => {
    expect(cardPageNotOpened('MOBILE_MONEY', unavailable)).toBe(false);
    expect(cardPageNotOpened('COD', unavailable)).toBe(false);
    expect(cardPageNotOpened('CARD', { status: 503, code: 'SERVICE_UNAVAILABLE' })).toBe(false);
    expect(cardPageNotOpened('CARD', { status: 502, code: 'PAYMENT_PROVIDER_UNAVAILABLE' })).toBe(
      false,
    );
    expect(cardPageNotOpened('CARD', { status: 409, code: 'CHECKOUT_NOT_OPEN' })).toBe(false);
    expect(cardPageNotOpened('CARD', { status: 0, code: 'NETWORK_ERROR' })).toBe(false);
    expect(cardPageNotOpened('CARD', null)).toBe(false);
    expect(cardPageNotOpened('CARD', undefined)).toBe(false);
  });
});
