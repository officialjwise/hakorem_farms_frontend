'use client';

import { useEffect } from 'react';
import { ApiError } from '@hakorem/api-client';
import { useApiMutation, useApiQuery } from '../../lib/browserApi';
import { rememberCart, useCartId } from '../../lib/cartId';

/** A cart that has ended: converted to an order, abandoned or expired. The next add starts a new one. */
const ENDED = new Set(['CONVERTED', 'ABANDONED', 'EXPIRED']);

/** Whole units in the contract's Quantity form: 2 is "2.000". */
export function toQuantity(units: number): string {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new RangeError(`A cart quantity is whole units; got ${units}.`);
  }
  return `${units}.000`;
}

/** A cart line's Quantity as whole units: "2.000" is 2. Cart quantities are whole units (1.32.0). */
export function toUnits(quantity: string): number {
  return Number.parseInt(quantity, 10);
}

/**
 * This visitor's cart: read live (prices re-resolve on every read, FR-SHP-003), and forgotten when the API
 * no longer knows it (404: another device's cookie, or a cleared one) or it has ended.
 */
export function useCart() {
  const id = useCartId();
  const query = useApiQuery('getCart', { path: { id: id ?? '' } }, { enabled: id !== null });
  const status = query.data?.status;
  const missing = query.error?.status === 404;
  useEffect(() => {
    if (id !== null && (missing || (status !== undefined && ENDED.has(status)))) {
      rememberCart(null);
    }
  }, [id, missing, status]);
  return { id, query };
}

/**
 * Adds whole units of a product, creating the cart first if there is none. One idempotency key per intent,
 * so a retry on a weak connection cannot add twice. A remembered cart the API no longer knows is replaced
 * once, then the add is tried again.
 */
export function useAddToCart() {
  const create = useApiMutation('createCart');
  const add = useApiMutation('addCartLine');
  const { id } = useCart();

  async function addLine(productId: string, units: number, keys: { create: string; add: string }) {
    const body = { productId, quantity: toQuantity(units) };
    let cartId = id;
    if (cartId === null) {
      const cart = await create.mutateAsync({}, { idempotencyKey: keys.create });
      rememberCart(cart.id);
      cartId = cart.id;
    }
    try {
      return await add.mutateAsync({ path: { id: cartId }, body }, { idempotencyKey: keys.add });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404 || id === null) throw error;
      const cart = await create.mutateAsync({}, { idempotencyKey: keys.create });
      rememberCart(cart.id);
      return add.mutateAsync({ path: { id: cart.id }, body }, { idempotencyKey: keys.add });
    }
  }

  return {
    addLine,
    isPending: create.isPending || add.isPending,
    error: add.error ?? create.error,
    reset: () => {
      create.reset();
      add.reset();
    },
  };
}
