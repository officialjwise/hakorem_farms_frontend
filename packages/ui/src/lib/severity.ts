import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

/** The four severities every alert, toast and alert row shares. */
export type Severity = 'good' | 'warning' | 'critical' | 'info';

export interface SeverityLook {
  /** Tint, text and edge for a box carrying words. */
  box: string;
  /** Stroke for the icon (a mark token: never text). */
  icon: string;
  /** A distinct shape per severity, so it reads without colour: check, triangle, circle-bang, i. */
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * One table, so an inline Alert, a Toast and an AlertRow of the same severity look and read the same.
 * Class strings are written out in full so Tailwind's scanner sees them.
 */
export const SEVERITY: Record<Severity, SeverityLook> = {
  good: { box: 'bg-good-subtle text-good-fg border-good', icon: 'stroke-good', Icon: CircleCheck },
  warning: {
    box: 'bg-warning-subtle text-warning-fg border-warning',
    icon: 'stroke-warning',
    Icon: TriangleAlert,
  },
  critical: {
    box: 'bg-critical-subtle text-critical-fg border-critical',
    icon: 'stroke-critical',
    Icon: CircleAlert,
  },
  info: { box: 'bg-info-subtle text-info-fg border-info', icon: 'stroke-info', Icon: Info },
};

/** Warning and critical interrupt (role="alert"); good and info wait their turn (role="status"). */
export function severityRole(severity: Severity): 'alert' | 'status' {
  return severity === 'critical' || severity === 'warning' ? 'alert' : 'status';
}
