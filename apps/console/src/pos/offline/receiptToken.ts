/**
 * The digital receipt's link (2.24.0, CR-033 points 1 and 2, ADR 0045). The till makes each sale's token
 * itself, offline if need be: 16 bytes from the device's secure generator, base64url with no padding, so
 * 22 characters, never derived from the sale's id, the device, the shift or the time. It fills the pack's
 * `receiptLinkTemplate` with it to show and print the link, and sends it with the sale as `receiptToken`.
 * The server keeps only its hash, and the link reads nothing until the sale has synced.
 */

const TOKEN_BYTES = 16;
const TOKEN = '{token}';
/** The contract's pattern for `OfflineSale.receiptToken`. */
export const RECEIPT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,86}$/;

export function newReceiptToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The link for a token: the template with the token in it, where the template is an absolute `https` URL
 * holding `{token}`. Null otherwise: the till then makes no link and sends no token, as the contract says.
 */
export function receiptLink(template: string | null | undefined, token: string): string | null {
  if (typeof template !== 'string' || !template.includes(TOKEN)) return null;
  try {
    const url = new URL(template.replace(TOKEN, encodeURIComponent(token)));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Whether the pack's template makes a link at all, so the till knows to make a token. */
export function templateUsable(template: string | null | undefined): template is string {
  return receiptLink(template, 'A'.repeat(22)) !== null;
}
