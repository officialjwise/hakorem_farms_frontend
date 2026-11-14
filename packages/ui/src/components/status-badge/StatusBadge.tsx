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
 * mark token (`good`) only ever draws the icon stroke and the border; text and
 * fills come from `good-fg`, `good-subtle` and `good-strong`, as the token roles
 * require.
 */
const SUBTLE: Record<BadgeTone, { badge: string; icon: string }> = {
  good: { badge: 'bg-good-subtle text-good-fg border-good', icon: 'stroke-good' },
  warning: { badge: 'bg-warning-subtle text-warning-fg border-warning', icon: 'stroke-warning' },
  critical: {
    badge: 'bg-critical-subtle text-critical-fg border-critical',
    icon: 'stroke-critical',
  },
  info: { badge: 'bg-info-subtle text-info-fg border-info', icon: 'stroke-info' },
  violet: { badge: 'bg-violet-subtle text-violet-fg border-violet', icon: 'stroke-violet' },
  plum: { badge: 'bg-plum-subtle text-plum-fg border-plum', icon: 'stroke-plum' },
  clay: { badge: 'bg-clay-subtle text-clay-fg border-clay', icon: 'stroke-clay' },
  slate: { badge: 'bg-slate-subtle text-slate-fg border-slate', icon: 'stroke-slate' },
};

const STRONG: Record<StatusTone, string> = {
  good: 'bg-good-strong text-good-on border-transparent',
  warning: 'bg-warning-strong text-warning-on border-transparent',
  critical: 'bg-critical-strong text-critical-on border-transparent',
  info: 'bg-info-strong text-info-on border-transparent',
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
  /** Required. A second, non-colour cue: shape tells states apart in sunlight and for colour-blind staff. */
  icon: BadgeIcon;
  className?: string;
  /** Not accepted: the label prop is the only content, so nothing can bypass it. */
  children?: never;
};

/**
 * StatusBadge. A state shown as icon + words + colour, never colour alone.
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
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 align-middle',
        'text-control-sm leading-tight font-semibold whitespace-nowrap',
        strong ? STRONG[tone as StatusTone] : SUBTLE[tone].badge,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        strokeWidth={2.5}
        className={cn('size-icon-sm shrink-0', !strong && SUBTLE[tone].icon)}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
