/**
 * Geometry for charts: where a value sits on the plot. No figure shown to anyone is computed here; the
 * screen passes every visible number already formatted. This only turns values into positions.
 */

/** A round axis maximum at or above `max`: 1, 2, 2.5 or 5 times a power of ten. Zero stays 1. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= max) return step * power;
  }
  return 10 * power;
}

/** Evenly spaced tick values from zero to `top`, inclusive. */
export function ticks(top: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

/** The centre of column `index` of `count`, as a percentage of the plot's width. */
export function columnCentre(index: number, count: number): number {
  return ((index + 0.5) / count) * 100;
}

/** A value's height as a percentage of the plot (0 at the baseline, 100 at `top`). */
export function heightOf(value: number, top: number): number {
  if (top <= 0) return 0;
  return Math.max(0, Math.min(100, (value / top) * 100));
}
