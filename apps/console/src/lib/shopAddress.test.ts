import { afterEach, describe, expect, it } from 'vitest';
import { assertShopUrlSet, parseShopUrl, quoteLink, shopUrl, whatsAppLink } from './shopAddress';

describe("the shop's address is the build's setting (ADR 0055)", () => {
  const before = process.env.HK_SHOP_URL;
  afterEach(() => {
    if (before === undefined) delete process.env.HK_SHOP_URL;
    else process.env.HK_SHOP_URL = before;
  });

  it('is read from HK_SHOP_URL, without a trailing slash, and null when unset', () => {
    process.env.HK_SHOP_URL = 'https://staging.hakoremfarms.com/';
    expect(shopUrl()).toBe('https://staging.hakoremfarms.com');
    delete process.env.HK_SHOP_URL;
    expect(shopUrl()).toBeNull();
    expect(parseShopUrl('  ')).toBeNull();
  });

  it('refuses anything but an http(s) address with no query', () => {
    expect(() => parseShopUrl('hakoremfarms.com')).toThrow(/not a web address/);
    expect(() => parseShopUrl('ftp://hakoremfarms.com')).toThrow(/http\(s\)/);
    expect(() => parseShopUrl('https://hakoremfarms.com/?a=1')).toThrow(/no query/);
  });

  it('fails a build for a real API without it, and lets the mock build through', () => {
    expect(() => assertShopUrlSet(undefined, '/api/v1')).toThrow(
      /HK_SHOP_URL is not set.*\/api\/v1/,
    );
    expect(() => assertShopUrlSet('', undefined)).toThrow(/no API/);
    expect(() => assertShopUrlSet(undefined, '/mock')).not.toThrow();
    expect(() => assertShopUrlSet('https://hakoremfarms.com', '/api/v1')).not.toThrow();
  });

  it("builds the storefront's link page for the token, and WhatsApp's chat for the number", () => {
    expect(quoteLink('https://hakoremfarms.com', 'quo_Ab-9_x')).toBe(
      'https://hakoremfarms.com/q/quo_Ab-9_x',
    );
    expect(whatsAppLink('+233557018924', 'Your quote: https://x.test/q/quo_1')).toBe(
      'https://wa.me/233557018924?text=Your%20quote%3A%20https%3A%2F%2Fx.test%2Fq%2Fquo_1',
    );
  });
});
