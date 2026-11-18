/**
 * The shop's public web address, for the links the console hands a customer (the owner, 2026-11-18;
 * ADR 0055). It is a deployment setting, `HK_SHOP_URL`, read at build time like `HK_API_BASE_URL`
 * (`vite.config.ts`), and never written into the code: staging and production each set their own, the
 * same origin the storefront is served from (`docs/DEPLOYMENT.md`, section 4).
 *
 * A build for a real API fails without it, before anything is built: every quote link it showed would be
 * lost, because the server answers a link's token once. A build against the mock may leave it unset; the
 * console then says in words that it cannot show the link.
 */
export const SHOP_URL_VARIABLE = 'HK_SHOP_URL';

/** The storefront's page for a quote by its link (`apps/storefront/src/app/q/[token]`). */
const QUOTE_LINK_PATH = '/q/';

/** The address as given, without a trailing slash, or null when unset. Anything but an http(s) origin fails. */
export function parseShopUrl(raw: string | undefined): string | null {
  const text = (raw ?? '').trim();
  if (text === '') return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${SHOP_URL_VARIABLE} is not a web address: "${text}".`);
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(
      `${SHOP_URL_VARIABLE} must be the shop's http(s) address with no query or fragment: "${text}".`,
    );
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/** Fails a build for any API but the mock that has no shop address (ADR 0055). */
export function assertShopUrlSet(raw: string | undefined, apiBaseUrl: string | undefined): void {
  const shop = parseShopUrl(raw);
  if (shop !== null || (apiBaseUrl ?? '').trim() === '/mock') return;
  throw new Error(
    `${SHOP_URL_VARIABLE} is not set, in a build for ${apiBaseUrl?.trim() || 'no API'}. Set it to the shop's address (docs/DEPLOYMENT.md): without it no quote link can be shown to pass on.`,
  );
}

/** This build's shop address, or null in a mock build without one. */
export function shopUrl(): string | null {
  // Written out in full: Vite replaces the literal at build time (vite.config.ts).
  return parseShopUrl(process.env.HK_SHOP_URL);
}

/** The customer's link to a quote, from the token `issueQuoteVersion` answered. */
export function quoteLink(shop: string, token: string): string {
  return `${shop}${QUOTE_LINK_PATH}${encodeURIComponent(token)}`;
}

/** WhatsApp's own address for a chat with this number, the message typed in (wa.me, E.164 without the +). */
export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
}
