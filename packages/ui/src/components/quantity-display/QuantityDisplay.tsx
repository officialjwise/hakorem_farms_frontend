import { cn } from '../../lib/cn';
import { NOT_APPLICABLE, formatQuantity, type QuantityPlaces } from '../../format/format';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type QuantityDisplayContext = 'interface' | 'document';

type NullProps =
  | { quantity: string; notApplicableLabel?: string }
  | { quantity: string | null; notApplicableLabel: string };

export type QuantityDisplayProps<U extends string = string> = NullProps & {
  /** Required. The unit of measure, already translated, for example "head" or "crates". */
  unit: NonEmpty<U>;
  /**
   * Required. The display precision the unit of measure declares: 0 for
   * countable units (head, crates, tubers, packs), 3 for weight and volume.
   * It comes from the unit, never from the wire format. A value with a
   * non-zero digit beyond it still shows that digit.
   */
  places: QuantityPlaces;
  context?: QuantityDisplayContext;
  strong?: boolean;
  className?: string;
};

/**
 * QuantityDisplay. The contract's Quantity string and its unit, at the
 * precision the unit declares: `3 head`, `1,250.500 kg`. A half crate always
 * shows as `2.5 crates` (see `formatQuantity`).
 */
export function QuantityDisplay<U extends string>({
  quantity,
  unit,
  places,
  notApplicableLabel,
  context = 'interface',
  strong = false,
  className,
}: QuantityDisplayProps<U>) {
  if (unit.trim() === '') {
    throw new Error('QuantityDisplay needs a non-empty unit.');
  }
  const base = cn('tabular-nums whitespace-nowrap', strong && 'font-semibold', className);
  if (quantity === null) {
    if ((notApplicableLabel ?? '').trim() === '') {
      throw new Error('QuantityDisplay needs notApplicableLabel text when the quantity is null.');
    }
    return (
      <span data-slot="quantity-display" data-empty="" className={base}>
        <span aria-hidden="true">{NOT_APPLICABLE}</span>
        <span className="sr-only">{notApplicableLabel}</span>
      </span>
    );
  }
  return (
    <span data-slot="quantity-display" className={base}>
      {formatQuantity(quantity, { context, places })} {unit}
    </span>
  );
}
