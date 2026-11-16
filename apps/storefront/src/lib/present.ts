import { formatWeight } from '@hakorem/ui';
import type { getT } from '../i18n/server';
import type { PriceWords } from '../components/PriceLine';
import type { CatalogueItem } from './shop';

export type ShopT = Awaited<ReturnType<typeof getT<'storefront'>>>;
type Priced = Pick<CatalogueItem, 'priceBasis' | 'saleUom'>;

/** What a price multiplies, in words: per kg for a weighed item, a head for an animal, else the sale unit. */
export function perWords(t: ShopT, item: Priced): string {
  if (item.priceBasis === 'PER_KG') return t('price.basis.PER_KG');
  if (item.priceBasis === 'PER_HEAD') return t('price.basis.PER_HEAD');
  return t(`price.uom.${item.saleUom}` as 'price.uom.UNIT', { defaultValue: t('price.uom.UNIT') });
}

export function priceWords(t: ShopT, item: Priced): PriceWords {
  return { to: t('price.to'), none: t('price.none'), per: perWords(t, item) };
}

/** "A pack, about 15.000 kg": what one sale unit of a weighed item is, from the API's nominal weight. */
export function unitLine(
  t: ShopT,
  item: Pick<CatalogueItem, 'catchWeight' | 'nominalPackKg' | 'saleUom'>,
): string | undefined {
  if (!item.catchWeight || item.nominalPackKg === null) return undefined;
  const unit = t(`price.unitTitle.${item.saleUom}` as 'price.unitTitle.PACK', {
    defaultValue: t('price.unitTitle.PACK'),
  });
  return t('price.unitAbout', { unit, weight: formatWeight(item.nominalPackKg) });
}

/** The contract's Percent string without trailing zeros: "10.00" is "10", "12.50" is "12.5", "100" stays. */
export function percentText(percent: string): string {
  return percent.includes('.') ? percent.replace(/0+$/, '').replace(/\.$/, '') : percent;
}
