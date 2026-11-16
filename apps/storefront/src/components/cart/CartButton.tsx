'use client';

import { ShoppingBasket } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@hakorem/ui';
import { counted, word, type Words } from '../../lib/words';
import { useCart } from './useCart';

/**
 * The drawer's code (the dialog primitive, the lines and their steppers) loads on the first tap, not with
 * every page: most visits browse and never open it (ADR 0015's first lever, measured in F7).
 */
const CartSheet = dynamic(() => import('./CartSheet').then((m) => m.CartSheet), { ssr: false });

/**
 * The basket button in the header, with the number of items once the cart is known. It opens the drawer,
 * and focus comes back to it when the drawer closes.
 */
export function CartButton({ words }: { words: Words }) {
  const { query } = useCart();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const count = query.data?.itemCount;
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
        {/* The name is the visible words: "Basket", the count, and "items" for a screen reader. */}
        {/* On a phone the word is for a screen reader only, so the wordmark keeps its room. */}
        <span className="sr-only sm:not-sr-only">{word(words, 'cart.open')}</span>
        {count === undefined ? null : (
          <>
            <span className="grid min-w-6 place-items-center rounded-full bg-surface px-1.5 text-sm font-semibold text-fg tabular-nums">
              {count}
            </span>
            <span className="sr-only">{counted(words, 'cart.items', count)}</span>
          </>
        )}
      </Button>
      {loaded ? <CartSheet open={open} onOpenChange={setOpen} words={words} /> : null}
    </>
  );
}
