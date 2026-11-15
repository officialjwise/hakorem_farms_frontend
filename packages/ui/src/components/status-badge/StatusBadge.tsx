import type { ComponentType, SVGProps } from 'react';
import { cn } from '../../lib/cn';

/** The four statuses, each with tint, strong fill, text and mark tokens. */
export type StatusTone = 'good' | 'warning' | 'critical' | 'info';
/** Categorical hues for states that are not good, warning or critical (reserved, quarantined, expiring, voided). */
export type CategoryTone = 'violet' | 'plum' | 'clay' | 'slate';
export type BadgeTone = StatusTone | CategoryTone;

/** Any icon component that accepts SVG props, such as a lucide-react icon. */
export type BadgeIcon = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * Full class strings per tone, written out so Tailwind's scanner sees them. The
 * mark token (`good`) only ever draws the dot; text and fills come from
 * `good-fg`, `good-subtle` and `good-strong`, as the token roles require.
 */
const SUBTLE: Record<BadgeTone, { badge: string; dot: string }> = {
  good: { badge: 'bg-good-subtle text-good-fg', dot: 'fill-good' },
  warning: { badge: 'bg-warning-subtle text-warning-fg', dot: 'fill-warning' },
  critical: { badge: 'bg-critical-subtle text-critical-fg', dot: 'fill-critical' },
  info: { badge: 'bg-info-subtle text-info-fg', dot: 'fill-info' },
  violet: { badge: 'bg-violet-subtle text-violet-fg', dot: 'fill-violet' },
  plum: { badge: 'bg-plum-subtle text-plum-fg', dot: 'fill-plum' },
  clay: { badge: 'bg-clay-subtle text-clay-fg', dot: 'fill-clay' },
  slate: { badge: 'bg-slate-subtle text-slate-fg', dot: 'fill-slate' },
};

const STRONG: Record<StatusTone, string> = {
  good: 'bg-good-strong text-good-on',
  warning: 'bg-warning-strong text-warning-on',
  critical: 'bg-critical-strong text-critical-on',
  info: 'bg-info-strong text-info-on',
};

/** Rejects an empty string literal at compile time. Dynamic empty strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

type ToneProps =
  | {
      tone: StatusTone;
      /** `subtle` (tint) for lists and tables; `strong` (solid) for the one status that must dominate, such as a void awaiting approval. */
      variant?: 'subtle' | 'strong';
    }
  | { tone: CategoryTone; variant?: 'subtle' };

export type StatusBadgeProps<L extends string = string> = ToneProps & {
  /**
   * Required. The badge's state in words, already translated. Colour never
   * carries state alone: no label, no badge.
   */
  label: NonEmpty<L>;
  /**
   * Drawn on the `strong` variant, beside the words. The subtle pill (the reference's) shows a dot instead:
   * the words are the cue that does not depend on colour.
   */
  icon?: BadgeIcon;
  className?: string;
  /** Not accepted: the label prop is the only content, so nothing can bypass it. */
  children?: never;
};

/**
 * StatusBadge. A state shown as words + colour, never colour alone: a tinted pill with a dot, or a solid
 * pill with an icon for the one status that must dominate.
 * Which state maps to which tone and icon is decided by the screen, from the
 * API's state enum; this component only renders it.
 */
export function StatusBadge<L extends string>({
  tone,
  variant = 'subtle',
  label,
  icon: Icon,
  className,
}: StatusBadgeProps<L>) {
  if (label.trim() === '') {
    throw new Error('StatusBadge needs a non-empty label: colour must never carry state alone.');
  }
  const strong = variant === 'strong' && tone in STRONG;
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 align-middle',
        'text-control-sm leading-tight font-semibold whitespace-nowrap',
        strong ? STRONG[tone as StatusTone] : SUBTLE[tone].badge,
        className,
      )}
    >
      {strong && Icon !== undefined ? (
        <Icon
          aria-hidden="true"
          focusable="false"
          strokeWidth={2.5}
          className="size-icon-sm shrink-0"
        />
      ) : strong ? null : (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 8 8"
          className={cn('size-2 shrink-0', SUBTLE[tone].dot)}
        >
          <circle cx="4" cy="4" r="4" />
        </svg>
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
