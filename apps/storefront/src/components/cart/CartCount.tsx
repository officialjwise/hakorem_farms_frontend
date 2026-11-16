'use client';

import { counted, type Words } from '../../lib/words';
import { ShopData } from '../ShopData';
import { useCart } from './useCart';

/** The number of items in the remembered cart, beside the basket's word, once the API has answered. */
function Count({ words }: { words: Words }) {
  const { query } = useCart();
  const count = query.data?.itemCount;
  if (count === undefined) return null;
  return (
    <>
      <span className="grid min-w-6 place-items-center rounded-full bg-surface px-1.5 text-sm font-semibold text-fg tabular-nums">
        {count}
      </span>
      <span className="sr-only">{counted(words, 'cart.items', count)}</span>
    </>
  );
}

export function CartCount({ words }: { words: Words }) {
  return (
    <ShopData>
      <Count words={words} />
    </ShopData>
  );
}
