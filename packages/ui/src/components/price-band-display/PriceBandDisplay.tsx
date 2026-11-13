import { cn } from '../../lib/cn';
import { NOT_APPLICABLE } from '../../format/format';
import { MoneyDisplay } from '../money-display/MoneyDisplay';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** The contract's PriceBand, as plain numbers. A selling price band, never a cost. */
export interface PriceBandValue {
  listPricePesewas: number;
  floorPricePesewas: number;
  ceilingPricePesewas: number;
}

type NullProps =
  | { band: PriceBandValue; notApplicableLabel?: string }
  | { band: PriceBandValue | null; notApplicableLabel: string };

export type PriceBandDisplayProps<B extends string = string> = NullProps & {
  /** Required. What the price multiplies, already translated, for example "per head". */
  basisLabel: NonEmpty<B>;
  /** Required. The word between floor and ceiling for screen readers, for example "to". Visually an en dash. */
  toLabel: string;
  /** Required. Names the secondary line, for example "List price". */
  listPriceLabel: string;
  className?: string;
};

/**
 * PriceBandDisplay. Shows selling prices only: `GH₵120.00 – GH₵220.00 per
 * head`, with the list price beneath. Cost is never shown here, and nothing is
 * computed: floor, ceiling and list come from the API's PriceBand.
 */
export function PriceBandDisplay<B extends string>({
  band,
  notApplicableLabel,
  basisLabel,
  toLabel,
  listPriceLabel,
  className,
}: PriceBandDisplayProps<B>) {
  if (basisLabel.trim() === '' || toLabel.trim() === '' || listPriceLabel.trim() === '') {
    throw new Error('PriceBandDisplay needs non-empty basisLabel, toLabel and listPriceLabel.');
  }
  const base = cn('inline-flex flex-col gap-0.5', className);
  if (band === null) {
    if ((notApplicableLabel ?? '').trim() === '') {
      throw new Error('PriceBandDisplay needs notApplicableLabel text when the band is null.');
    }
    return (
      <span data-slot="price-band-display" data-empty="" className={base}>
        <span aria-hidden="true">{NOT_APPLICABLE}</span>
        <span className="sr-only">{notApplicableLabel}</span>
      </span>
    );
  }
  const single = band.floorPricePesewas === band.ceilingPricePesewas;
  return (
    <span data-slot="price-band-display" className={base}>
      <span className="whitespace-nowrap">
        <MoneyDisplay pesewas={band.floorPricePesewas} strong />
        {single ? null : (
          <>
            {' '}
            <span aria-hidden="true">{NOT_APPLICABLE}</span>
            <span className="sr-only">{toLabel}</span>{' '}
            <MoneyDisplay pesewas={band.ceilingPricePesewas} strong />
          </>
        )}{' '}
        <span className="text-fg-muted">{basisLabel}</span>
      </span>
      <span className="text-control-sm text-fg-muted">
        {listPriceLabel} <MoneyDisplay pesewas={band.listPricePesewas} />
      </span>
    </span>
  );
}
