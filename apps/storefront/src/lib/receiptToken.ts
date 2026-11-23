/**
 * A receipt link's token as the till makes it (contract 2.24.0, `getPublicReceipt`, CR-033 point 2): at
 * least 128 random bits, base64url without padding, 22 to 86 characters. Anything else cannot be a live
 * link, so the page answers it as the server answers every dead one (404) without sending a request.
 */
const RECEIPT_TOKEN = /^[A-Za-z0-9_-]{22,86}$/;

export function isReceiptToken(token: string): boolean {
  return RECEIPT_TOKEN.test(token);
}
