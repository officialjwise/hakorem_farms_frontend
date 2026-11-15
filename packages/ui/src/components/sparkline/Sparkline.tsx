import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface SparklineProps<L extends string = string> {
  /** The API's series, oldest first, for example sales per day in pesewas. Drawn, never summed. */
  values: readonly number[];
  /** Required. What the line shows, for example "Sales over the last 7 days". Its accessible name. */
  label: NonEmpty<L>;
  className?: string;
}

const W = 96;
const H = 36;
const PAD = 2;

/**
 * Sparkline (ADR 0036). The small trend beside a stat tile's figure, as the reference draws it: a line in
 * the accent over a soft area. It shows the shape of a series the API sends; with fewer than two points
 * it draws nothing, never an invented line. The figures themselves are the tile's; this is a picture of
 * them, named by `label`.
 */
export function Sparkline<L extends string>({ values, label, className }: SparklineProps<L>) {
  if (label.trim() === '') throw new Error('Sparkline needs a non-empty label.');
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = PAD + (index * (W - PAD * 2)) / (values.length - 1);
    const y = H - PAD - ((value - min) * (H - PAD * 2)) / span;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const area = `${line} L${points.at(-1)?.[0] ?? W} ${H} L${points[0]?.[0] ?? 0} ${H} Z`;
  return (
    <svg
      role="img"
      aria-label={label}
      data-slot="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <path d={area} className="fill-series-1-area" />
      <path
        d={line}
        className="fill-none stroke-accent"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
