import { MessageCircle, Scale } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@hakorem/ui';
import { priceWords, unitLine, type ShopT } from '../lib/present';
import {
  AVAILABILITY,
  cardPhoto,
  GRID_PHOTO_SIZES,
  tileFor,
  type CatalogueItem,
} from '../lib/shop';
import { PriceLine } from './PriceLine';

/** How many cards load their photograph eagerly: the first row on a phone (two) and at 1280 px (four). */
const EAGER = 4;

/**
 * A listing's products as cards, two across on a phone. A server component: a listing ships no script of
 * its own, only each card's photograph leaf. Everything shown is what the API sent.
 */
export function ProductGrid({
  items,
  t,
  label,
}: {
  items: readonly CatalogueItem[];
  t: ShopT;
  /** The list's accessible name, for example the category's. */
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
    >
      {items.map((item, index) => {
        const tile = tileFor(item);
        const note = item.catchWeight
          ? { icon: Scale, text: t('note.weighed') }
          : item.onlineMode === 'REQUEST_TO_BUY'
            ? { icon: MessageCircle, text: t('note.request') }
            : undefined;
        return (
          <li key={item.productId}>
            <ProductCard
              nameLink={
                // No prefetch: twelve product routes fetched ahead on 3G cost more than a tap waits.
                <Link href={`/p/${item.slug}`} prefetch={false}>
                  {item.name}
                </Link>
              }
              photo={cardPhoto(item.image)}
              photoLabel={item.name}
              placeholderIcon={tile.icon}
              tone={tile.tone}
              photoSizes={GRID_PHOTO_SIZES}
              eager={index < EAGER}
              price={<PriceLine item={item} words={priceWords(t, item)} />}
              unitLine={unitLine(t, item)}
              availability={{
                tone: AVAILABILITY[item.availability],
                label: t(`availability.${item.availability}`),
              }}
              note={note}
            />
          </li>
        );
      })}
    </ul>
  );
}
