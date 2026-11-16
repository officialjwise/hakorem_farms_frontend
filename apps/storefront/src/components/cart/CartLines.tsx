'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { components } from '@hakorem/api-client';
import { newIdempotencyKey } from '@hakorem/api-client';
import {
  Button,
  CatchWeightNotice,
  MoneyDisplay,
  ProductPhoto,
  QuantityStepper,
  WeightDisplay,
} from '@hakorem/ui';
import { useApiMutation } from '../../lib/browserApi';
import { tileForName } from '../../lib/shop';
import { fill, refusal, word, type Words } from '../../lib/words';
import { toQuantity, toUnits } from './useCart';

type Cart = components['schemas']['Cart'];
type CartLine = Cart['lines'][number];

/** What a line's price multiplies, in words: per kg, a head, or its unit. */
export function perUnit(words: Words, line: Pick<CartLine, 'priceBasis' | 'uom'>): string {
  if (line.priceBasis === 'PER_KG') return word(words, 'price.basis.PER_KG');
  if (line.priceBasis === 'PER_HEAD') return word(words, 'price.basis.PER_HEAD');
  const said = word(words, `price.uom.${line.uom}`);
  return said === `price.uom.${line.uom}` ? word(words, 'price.uom.UNIT') : said;
}

/**
 * The cart's lines, each with its photograph tile, today's price, its quantity, and the API's estimate.
 * A weighed line says it is weighed before it is sent, with its estimated weight. A change that fails
 * stays on its line in words until the next attempt. Every figure is the API's.
 */
export function CartLines({ cart, words }: { cart: Cart; words: Words }) {
  return (
    <ul className="grid gap-3" aria-label={word(words, 'cart.title')}>
      {cart.lines.map((line) => (
        <li key={line.id}>
          <Line cartId={cart.id} line={line} words={words} />
        </li>
      ))}
    </ul>
  );
}

function Line({ cartId, line, words }: { cartId: string; line: CartLine; words: Words }) {
  const update = useApiMutation('updateCartLine');
  const remove = useApiMutation('removeCartLine');
  // The number asked for while it is being sent; otherwise the server's, so a refused change never stays.
  const [asked, setAsked] = useState<number | null>(null);
  const key = useRef<{ units: number; key: string } | null>(null);
  const name = line.product.name;
  const tile = tileForName(name);
  const failure = update.error ?? remove.error;
  const units = update.isPending && asked !== null ? asked : toUnits(line.quantity);

  const change = (next: number) => {
    setAsked(next);
    remove.reset();
    // One key per quantity asked for: a retry of the same number reuses it.
    if (key.current?.units !== next) key.current = { units: next, key: newIdempotencyKey() };
    update.mutate(
      { path: { id: cartId, lineId: line.id }, body: { quantity: toQuantity(next) } },
      { idempotencyKey: key.current.key },
    );
  };

  return (
    <article
      aria-label={name}
      className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <ProductPhoto
        photo={line.product.image}
        placeholderIcon={tile.icon}
        placeholderLabel={name}
        tone={tile.tone}
        sizes="4rem"
        className="rounded-md"
      />
      <div className="grid min-w-0 gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/p/${line.product.slug}`}
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            {name}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={fill(word(words, 'cart.remove'), { name })}
            disabled={remove.isPending}
            onClick={() => {
              update.reset();
              remove.mutate({ path: { id: cartId, lineId: line.id } });
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <p className="text-sm text-fg-muted">
          <MoneyDisplay pesewas={line.displayedUnitPricePesewas} /> {perUnit(words, line)}
        </p>
        {line.catchWeight && line.estimatedWeightKg !== null ? (
          <CatchWeightNotice
            size="compact"
            title={word(words, 'cart.weighed')}
            facts={[
              {
                term: word(words, 'cart.estimatedWeight'),
                value: <WeightDisplay kilograms={line.estimatedWeightKg} />,
              },
            ]}
          />
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <QuantityStepper
            label={fill(word(words, 'cart.quantityOf'), { name })}
            value={units}
            onValueChange={change}
            decreaseLabel={fill(word(words, 'cart.fewer'), { name })}
            increaseLabel={fill(word(words, 'cart.more'), { name })}
            max={99}
          />
          <p className="text-end">
            <span className="block text-sm text-fg-muted">
              {word(words, line.catchWeight ? 'cart.lineEstimate' : 'cart.lineTotal')}
            </span>
            <MoneyDisplay pesewas={line.estimatedLineTotalPesewas} strong />
          </p>
        </div>
        {line.available ? null : (
          <p className="text-sm font-medium text-warning-fg">{word(words, 'cart.unavailable')}</p>
        )}
        {failure === null ? null : (
          <p role="alert" className="text-sm font-medium text-critical-fg">
            {word(words, 'cart.changeFailed')}. {refusal(words, failure)}
          </p>
        )}
      </div>
    </article>
  );
}
