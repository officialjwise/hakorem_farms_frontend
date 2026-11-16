'use client';

import { Check, ShoppingBasket } from 'lucide-react';
import { useRef, useState } from 'react';
import { newIdempotencyKey } from '@hakorem/api-client';
import { Button, QuantityStepper } from '@hakorem/ui';
import { refusal, word, type Words } from '../lib/words';
import { useAddToCart } from './cart/useCart';

/**
 * How many, and "Add to basket", on a product page. Whole units of the sale unit (contract 1.32.0). The
 * answer is said in words beside the button: added, or why not, and that stays until the next try.
 */
export function AddToBasket({
  productId,
  unitPlural,
  words,
}: {
  productId: string;
  /** The sale unit in the plural, for the quantity's name: "packs", "crates". */
  unitPlural: string;
  words: Words;
}) {
  const [units, setUnits] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useAddToCart();
  // One intent per quantity: a retry of the same add reuses its keys, so it cannot add twice.
  const intent = useRef<{ units: number; create: string; add: string } | null>(null);
  const add = async () => {
    if (intent.current?.units !== units) {
      intent.current = { units, create: newIdempotencyKey(), add: newIdempotencyKey() };
    }
    cart.reset();
    setAdded(false);
    try {
      await cart.addLine(productId, units, intent.current);
      intent.current = null;
      setAdded(true);
    } catch {
      // The failure is on screen from `cart.error`, in words.
    }
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <QuantityStepper
          label={`${word(words, 'addToBasket.quantity')} (${unitPlural})`}
          showLabel
          size="lg"
          value={units}
          onValueChange={(next) => {
            setUnits(next);
            setAdded(false);
          }}
          decreaseLabel={word(words, 'addToBasket.fewer')}
          increaseLabel={word(words, 'addToBasket.more')}
        />
        <Button
          size="lg"
          onClick={() => void add()}
          loading={cart.isPending}
          loadingLabel={word(words, 'addToBasket.adding')}
        >
          <ShoppingBasket aria-hidden="true" />
          {word(words, 'addToBasket.add')}
        </Button>
      </div>
      <div aria-live="polite">
        {added ? (
          <p className="flex items-center gap-2 font-medium text-good-fg">
            <Check aria-hidden="true" className="size-icon-md stroke-good" />
            {word(words, 'addToBasket.added')}
          </p>
        ) : null}
      </div>
      {cart.error === null ? null : (
        <p role="alert" className="font-medium text-critical-fg">
          {word(words, 'addToBasket.failed')}. {refusal(words, cart.error)}
        </p>
      )}
    </div>
  );
}
