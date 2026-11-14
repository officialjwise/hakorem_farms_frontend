import { cn } from '../../lib/cn';
import { NOT_APPLICABLE, formatMoney } from '../../format/format';

/** Where the amount is shown. Exports are files, not displays, so 'export' is not accepted. */
export type MoneyDisplayContext = 'interface' | 'document';

/**
 * A value that can be null (does not apply) must say so in words: the dash is
 * hidden from screen readers and `notApplicableLabel` is read instead.
 */
type NullProps =
  | { pesewas: number | bigint; notApplicableLabel?: string }
  | { pesewas: number | bigint | null; notApplicableLabel: string };

export type MoneyDisplayProps = NullProps & {
  context?: MoneyDisplayContext;
  /**
   * The contract's Pesewas is never negative; direction travels in a separate
   * field. Pass true to show a minus for an outgoing amount.
   */
  negative?: boolean;
  /** Emphasis, for a total the eye must find. */
  strong?: boolean;
  className?: string;
};

/**
 * MoneyDisplay. Integer pesewas to GH₵ (interface) or GHS (document), through
 * `formatMoney` only: no locale, no float arithmetic, no calculation.
 */
export function MoneyDisplay({
  pesewas,
  notApplicableLabel,
  context = 'interface',
  negative = false,
  strong = false,
  className,
}: MoneyDisplayProps) {
  const base = cn('tabular-nums whitespace-nowrap', strong && 'font-semibold', className);
  if (pesewas === null) {
    if ((notApplicableLabel ?? '').trim() === '') {
      throw new Error('MoneyDisplay needs notApplicableLabel text when the amount is null.');
    }
    return (
      <span data-slot="money-display" data-empty="" className={base}>
        <span aria-hidden="true">{NOT_APPLICABLE}</span>
        <span className="sr-only">{notApplicableLabel}</span>
      </span>
    );
  }
  const value = negative ? -BigInt(pesewas) : pesewas;
  return (
    <span data-slot="money-display" className={base}>
      {formatMoney(value, { context })}
    </span>
  );
}
