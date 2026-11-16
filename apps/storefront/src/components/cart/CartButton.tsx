'use client';

import { ShoppingBasket } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@hakorem/ui';
import { useCartId } from '../../lib/cartId';
import { word, type Words } from '../../lib/words';

/**
 * The drawer's code (the dialog, the lines and their steppers) loads on the first tap, and the count's (the
 * data layer) only once this device has a cart: a first visit that only browses loads neither (ADR 0041).
 */
const CartSheet = dynamic(() => import('./CartSheet').then((m) => m.CartSheet), { ssr: false });
const CartCount = dynamic(() => import('./CartCount').then((m) => m.CartCount), { ssr: false });

/**
 * The basket button in the header: the word, and the number of items once the cart is known. It opens the
 * drawer, and focus comes back to it when the drawer closes. Its name is its visible words, with "items"
 * for a screen reader.
 */
export function CartButton({ words }: { words: Words }) {
  const id = useCartId();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return (
    <>
      <Button
        ref={button}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <ShoppingBasket aria-hidden="true" />
        {/* On a phone the word is for a screen reader only, so the wordmark keeps its room. */}
        <span className="sr-only sm:not-sr-only">{word(words, 'cart.open')}</span>
        {id === null ? null : <CartCount words={words} />}
      </Button>
      {loaded ? <CartSheet open={open} onOpenChange={setOpen} words={words} /> : null}
    </>
  );
}
