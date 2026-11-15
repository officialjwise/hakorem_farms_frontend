import type { ComponentType, SVGProps } from 'react';
import { cn } from '../../lib/cn';

/** The tints a chip may wear: the accent, the second series, and the categorical hues. */
export type IconChipTone =
  | 'accent'
  | 'sand'
  | 'good'
  | 'warning'
  | 'critical'
  | 'info'
  | 'violet'
  | 'plum'
  | 'clay'
  | 'slate';

/*
 * Written out so Tailwind's scanner sees them. The tint is a `-subtle` surface and the icon a mark token's
 * stroke, as the token roles require (ADR 0001). `sand` is the second chart series' stroke on the warm tint.
 */
const TONE: Record<IconChipTone, { chip: string; icon: string }> = {
  accent: { chip: 'bg-accent-subtle', icon: 'stroke-accent' },
  sand: { chip: 'bg-warning-subtle', icon: 'stroke-series-2' },
  good: { chip: 'bg-good-subtle', icon: 'stroke-good' },
  warning: { chip: 'bg-warning-subtle', icon: 'stroke-warning' },
  critical: { chip: 'bg-critical-subtle', icon: 'stroke-critical' },
  info: { chip: 'bg-info-subtle', icon: 'stroke-info' },
  violet: { chip: 'bg-violet-subtle', icon: 'stroke-violet' },
  plum: { chip: 'bg-plum-subtle', icon: 'stroke-plum' },
  clay: { chip: 'bg-clay-subtle', icon: 'stroke-clay' },
  slate: { chip: 'bg-slate-subtle', icon: 'stroke-slate' },
};

const SIZE = {
  sm: { chip: 'size-8 rounded-md', icon: 'size-icon-sm' },
  md: { chip: 'size-10 rounded-lg', icon: 'size-icon-md' },
  lg: { chip: 'size-12 rounded-lg', icon: 'size-icon-lg' },
} as const;

export interface IconChipProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: IconChipTone;
  size?: keyof typeof SIZE;
  className?: string;
}

/**
 * IconChip (ADR 0036). An icon on a tinted square: beside a stat's label, a modal's title, or a table row
 * with no image, saying which kind of thing it is at a glance. Always decorative: the words beside it
 * carry the meaning, so it is hidden from assistive technology and takes no label.
 */
export function IconChip({ icon: Icon, tone = 'accent', size = 'md', className }: IconChipProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="icon-chip"
      data-tone={tone}
      className={cn(
        'grid shrink-0 place-items-center',
        SIZE[size].chip,
        TONE[tone].chip,
        className,
      )}
    >
      <Icon focusable="false" strokeWidth={2} className={cn(SIZE[size].icon, TONE[tone].icon)} />
    </span>
  );
}
