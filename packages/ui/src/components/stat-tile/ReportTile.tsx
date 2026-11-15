import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type ReportTileTone = 'accent' | 'sand' | 'info' | 'good';

/*
 * Written out so Tailwind's scanner sees them. The corner is a `-subtle` tint; the diamond a solid fill
 * with its paired on-colour for the icon, as the token roles require (ADR 0001). Sand is the warning pair:
 * the second series' warm hue as a fill.
 */
const TONE: Record<ReportTileTone, { corner: string; diamond: string }> = {
  accent: { corner: 'bg-accent-subtle', diamond: 'bg-accent text-accent-fg' },
  sand: { corner: 'bg-warning-subtle', diamond: 'bg-warning-strong text-warning-on' },
  info: { corner: 'bg-info-subtle', diamond: 'bg-info-strong text-info-on' },
  good: { corner: 'bg-good-subtle', diamond: 'bg-good-strong text-good-on' },
};

export interface ReportTileProps<L extends string = string> {
  /** Required. What the figure is, already translated, for example "Total sales". */
  label: NonEmpty<L>;
  /** The API's figure, already formatted. */
  value: ReactNode;
  /** A line under the figure, for example "Total for the range". */
  detail?: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: ReportTileTone;
  className?: string;
}

/**
 * ReportTile (ADR 0036). A report's summary figure as the reference draws it: a tinted wedge in the
 * leading corner and the icon on a solid diamond beside the figure. Decoration only; the label and the
 * figure carry the meaning, and both are the API's.
 */
export function ReportTile<L extends string>({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'accent',
  className,
}: ReportTileProps<L>) {
  if (label.trim() === '') throw new Error('ReportTile needs a non-empty label.');
  return (
    <div
      data-slot="report-tile"
      className={cn(
        'relative flex min-w-0 items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface p-5 ps-6 text-fg shadow-sm',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute start-0 top-0 size-20 [clip-path:polygon(0_0,100%_0,0_100%)] rtl:[clip-path:polygon(0_0,100%_0,100%_100%)]',
          TONE[tone].corner,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'relative grid size-10 shrink-0 rotate-45 place-items-center rounded-md shadow-sm',
          TONE[tone].diamond,
        )}
      >
        <Icon focusable="false" strokeWidth={2.25} className="size-icon-md -rotate-45" />
      </span>
      <span className="relative grid min-w-0 gap-0.5">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className="text-xl font-bold break-words tabular-nums sm:text-2xl">{value}</span>
        {detail === undefined ? null : (
          <span className="text-control-sm text-fg-muted">{detail}</span>
        )}
      </span>
    </div>
  );
}
