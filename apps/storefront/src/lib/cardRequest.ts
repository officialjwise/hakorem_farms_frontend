/**
 * The card request of the checkout open in this tab (the owner, 2026-11-25; ADR 0060): its idempotency key
 * and the body sent with it, kept in the tab's session storage so that a reload while the card page could
 * not be opened (503 `PAYMENT_PROVIDER_UNAVAILABLE`) can still replay the same request and open that
 * order's page, never place a second one.
 *
 * - **One checkout only.** One entry, naming its checkout. Remembering another checkout's request
 *   replaces it, and reading it for any other checkout clears it.
 * - **Gone when the checkout is done with:** cleared when the order's card page is handed over, when the
 *   request is refused with nothing placed, when the checkout reads expired, cancelled or completed, and
 *   once the checkout's hold has lapsed (`Checkout.reservedUntil`, as the server reads it now). Session
 *   storage also ends with the tab.
 * - **The key alone opens nothing.** It is only ever sent as the `Idempotency-Key` of `placeOrder` on this
 *   checkout, with the guest cookie that proves the checkout is this browser's (contract 2.30.0); another
 *   browser's checkout is 404. CR-066 asks the backend to state that a replay is checked the same way.
 *   It never goes in an address, a log or local storage.
 *
 * Storage can be refused (a private window, a full disk): then nothing is kept, and the shop works as it
 * did before, for as long as the page is open.
 */

import { useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'hk_card_request';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CardRequest {
  checkoutId: string;
  /** The exact body sent, as JSON: a replay must send the same body with the same key. */
  said: string;
  key: string;
  /** The server answered that the order is placed but its card page did not open. */
  notOpened: boolean;
}

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function changed(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a stored value is a card request of the shape this module writes, and nothing else. */
function isCardRequest(value: unknown): value is CardRequest {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r['checkoutId'] !== 'string' || typeof r['said'] !== 'string') return false;
  if (typeof r['key'] !== 'string' || !UUID.test(r['key'])) return false;
  if (typeof r['notOpened'] !== 'boolean') return false;
  try {
    const body = JSON.parse(r['said']) as { paymentMethod?: unknown };
    return body.paymentMethod === 'CARD';
  } catch {
    return false;
  }
}

/** The request in a stored value, if it is one and it is this checkout's; otherwise null. */
export function cardRequestFor(raw: string | null, checkoutId: string): CardRequest | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isCardRequest(parsed) && parsed.checkoutId === checkoutId ? parsed : null;
}

export function rememberCardRequest(request: CardRequest): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(request));
  } catch {
    // Refused: the request lasts as long as the page, as before.
  }
  changed();
}

export function forgetCardRequest(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept.
  }
  changed();
}

/**
 * Clears what is kept unless it is this checkout's request and the checkout's hold (`reservedUntil`, as the
 * server reads it now) has not lapsed: another checkout's, a lapsed one's, or anything not of this shape.
 * After the hold the order is cancelled, so there is nothing left to replay.
 */
export function forgetStaleCardRequest(
  checkoutId: string,
  reservedUntil: string,
  now: number = Date.now(),
): void {
  const raw = read();
  if (raw === null) return;
  const until = Date.parse(reservedUntil);
  if (cardRequestFor(raw, checkoutId) === null || Number.isNaN(until) || now >= until) {
    forgetCardRequest();
  }
}

/** The card request kept in this tab for this checkout, or null. Null on the server and before hydration. */
export function useKeptCardRequest(checkoutId: string): CardRequest | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => cardRequestFor(raw, checkoutId), [raw, checkoutId]);
}
