import { useSyncExternalStore } from 'react';

/**
 * A value remembered on the device for this visitor: which cart is theirs. The open checkout is the cart's
 * own (`Cart.checkoutId`, CR-029), so it is not remembered here.
 * An id proves nothing on its own: the API checks the guest cookie it set with the cart, so another
 * visitor's id is a 404. Storage can be refused (a private window, a full disk); then the value lasts as
 * long as the page, which is still a working shop.
 */
function remembered(key: string) {
  const listeners = new Set<() => void>();
  let memory: string | null = null;

  function read(): string | null {
    try {
      return window.localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  }

  function remember(value: string | null): void {
    memory = value;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Storage refused: the in-memory value keeps it for this page.
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  /** The remembered value, or null. On the server, and before hydration, always null. */
  function useValue(): string | null {
    return useSyncExternalStore(subscribe, read, () => null);
  }

  return { remember, useValue };
}

const cart = remembered('hk_cart');

export const rememberCart = cart.remember;
export const useCartId = cart.useValue;

/**
 * The cart's open checkout, as the server says (CR-029): its id while the cart is at checkout, so a second
 * tab or device with the same cart cookie opens the same checkout. Null in every other status.
 */
export function openCheckoutId(
  cart: { status: string; checkoutId: string | null } | undefined,
): string | null {
  return cart?.status === 'CHECKOUT' ? cart.checkoutId : null;
}
