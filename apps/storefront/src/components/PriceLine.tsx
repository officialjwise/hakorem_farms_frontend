import { MoneyDisplay } from '@hakorem/ui';
import type { CatalogueItem } from '../lib/shop';

export interface PriceWords {
  to: string;
  none: string;
  /** What the price multiplies, by basis and sale unit, already chosen: "per kg", "a crate", "a head". */
  per: string;
}

/**
 * A product's price as the API gives it: one price, or a band from its lowest to its highest list price
 * (a live animal). Nothing is computed. No price at all says so in words.
 */
export function PriceLine({
  item,
  words,
  size = 'card',
}: {
  item: Pick<CatalogueItem, 'priceFromPesewas' | 'priceToPesewas'>;
  words: PriceWords;
  size?: 'card' | 'page';
}) {
  const from = item.priceFromPesewas;
  const to = item.priceToPesewas;
  if (from === null) return <span className="text-fg-muted">{words.none}</span>;
  const strong = size === 'page' ? 'text-2xl' : undefined;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      <MoneyDisplay pesewas={from} strong className={strong} />
      {to === null || to === from ? null : (
        <>
          <span className="text-fg-muted">{words.to}</span>
          <MoneyDisplay pesewas={to} strong className={strong} />
        </>
      )}
      <span className="text-fg-muted">{words.per}</span>
    </span>
  );
}
