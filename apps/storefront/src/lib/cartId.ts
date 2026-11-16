import { useSyncExternalStore } from 'react';

/**
 * A value remembered on the device for this visitor: which cart is theirs, and which checkout is open.
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
const checkout = remembered('hk_checkout');

export const rememberCart = cart.remember;
export const useCartId = cart.useValue;
export const rememberCheckout = checkout.remember;
export const useCheckoutId = checkout.useValue;
