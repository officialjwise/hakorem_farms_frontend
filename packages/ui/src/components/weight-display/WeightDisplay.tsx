import { cn } from '../../lib/cn';
import { NOT_APPLICABLE, formatWeight } from '../../format/format';

export type WeightDisplayContext = 'interface' | 'document';

type NullProps =
  | { kilograms: string; notApplicableLabel?: string }
  | { kilograms: string | null; notApplicableLabel: string };

export type WeightDisplayProps = NullProps & {
  context?: WeightDisplayContext;
  strong?: boolean;
  className?: string;
};

/**
 * WeightDisplay. The contract's Kilograms string to `38.400 kg`, through
 * `formatWeight` only. Never rounds: more than three places is refused.
 */
export function WeightDisplay({
  kilograms,
  notApplicableLabel,
  context = 'interface',
  strong = false,
  className,
}: WeightDisplayProps) {
  const base = cn('tabular-nums whitespace-nowrap', strong && 'font-semibold', className);
  if (kilograms === null) {
    if ((notApplicableLabel ?? '').trim() === '') {
      throw new Error('WeightDisplay needs notApplicableLabel text when the weight is null.');
    }
    return (
      <span data-slot="weight-display" data-empty="" className={base}>
        <span aria-hidden="true">{NOT_APPLICABLE}</span>
        <span className="sr-only">{notApplicableLabel}</span>
      </span>
    );
  }
  return (
    <span data-slot="weight-display" className={base}>
      {formatWeight(kilograms, { context })}
    </span>
  );
}
