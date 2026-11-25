/**
 * The card provider's hosted page (contract 2.30.0, `placeOrder`): `payment.redirectUrl` is "always on
 * `https://checkout.paystack.com/`". The shop sends a customer to that page and to no other, so an answer
 * naming any other address (another host, another scheme, a user name in front of the host, a port) is
 * refused before the browser goes anywhere. A wrong address would send someone to type their card on a
 * stranger's page.
 */
export const CARD_PAGE_ORIGIN = 'https://checkout.paystack.com';
const CARD_PAGE_PREFIX = `${CARD_PAGE_ORIGIN}/`;

/** The address to send the browser to, or null when it is not the card provider's page. */
export function cardPageUrl(redirectUrl: string | null | undefined): string | null {
  if (typeof redirectUrl !== 'string' || !redirectUrl.startsWith(CARD_PAGE_PREFIX)) return null;
  // Tabs and line breaks are dropped by a browser when it reads an address, so none is let through.
  if (/[\s\\]/.test(redirectUrl)) return null;
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return null;
  }
  if (url.origin !== CARD_PAGE_ORIGIN || url.username !== '' || url.password !== '') return null;
  return url.href;
}

/**
 * True when a card placement answered that the order is placed but its card page did not open: 503
 * `PAYMENT_PROVIDER_UNAVAILABLE` (contract 2.30.0). The payment waits, and a replay with the same
 * idempotency key opens the page for the same order, never a second one. Any other refusal placed nothing.
 */
export function cardPageNotOpened(
  method: 'MOBILE_MONEY' | 'CARD' | 'COD',
  error: { status: number; code: string } | null | undefined,
): boolean {
  return (
    method === 'CARD' &&
    error != null &&
    error.status === 503 &&
    error.code === 'PAYMENT_PROVIDER_UNAVAILABLE'
  );
}
