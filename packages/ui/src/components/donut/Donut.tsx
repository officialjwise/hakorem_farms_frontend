import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface DonutSegment {
  /** Required. The segment's name, such as "Mobile money". */
  label: string;
  /** Geometry only: the segment's size in its own unit. */
  value: number;
  /** The figure people read, already formatted, such as "GH₵ 2,454.00 · 31 sales". */
  formatted: string;
}

export type DonutProps<T extends string = string> = {
  /** Required. What the donut shows, such as "Sales by channel today". */
  title: NonEmpty<T>;
  segments: readonly DonutSegment[];
  /** What sits in the hole: the API's total, already formatted, and what it is. */
  centre?: ReactNode;
  /** Hide the title when a card around the donut already says it. */
  hideTitle?: boolean;
  className?: string;
};

/*
 * Up to five segments. Each has a hue and, in the legend, a marker shape of its own (circle, square,
 * triangle, diamond, bar), so the legend is read by shape where hue fails. Segments are separated by gaps.
 */
const LOOKS = [
  { stroke: 'stroke-accent', fill: 'fill-accent', marker: 'M6 2 a4 4 0 1 0 0.01 0' },
  { stroke: 'stroke-series-2', fill: 'fill-series-2', marker: 'M2 2 H10 V10 H2 Z' },
  { stroke: 'stroke-info', fill: 'fill-info', marker: 'M6 1.5 L10.5 10 H1.5 Z' },
  { stroke: 'stroke-violet', fill: 'fill-violet', marker: 'M6 1 L11 6 L6 11 L1 6 Z' },
  { stroke: 'stroke-slate', fill: 'fill-slate', marker: 'M1 4.5 H11 V7.5 H1 Z' },
] as const;

const RADIUS = 15.9155; // circumference 100, so dash lengths read as percentages of the ring
const GAP = 1;

/**
 * Donut. Parts of a whole, such as sales by channel or by payment method. The ring is drawn from the
 * values; every figure people read comes formatted from the screen, in a legend that is a list, so a
 * screen reader reads names and figures in order and nothing depends on hue alone.
 */
export function Donut<T extends string>({
  title,
  segments,
  centre,
  hideTitle = false,
  className,
}: DonutProps<T>) {
  if (title.trim() === '') throw new Error('A donut needs a non-empty title.');
  const shown = segments.slice(0, LOOKS.length);
  const total = shown.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let offset = 0;
  return (
    <figure data-slot="donut" aria-label={title} className={cn('grid min-w-0 gap-3', className)}>
      <figcaption className={cn('font-semibold', hideTitle && 'sr-only')}>{title}</figcaption>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative size-36 shrink-0">
          <svg
            viewBox="0 0 42 42"
            className="size-full -rotate-90"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="21"
              cy="21"
              r={RADIUS}
              fill="none"
              className="stroke-series-1-area"
              strokeWidth={6}
            />
            {total > 0
              ? shown.map((segment, index) => {
                  const share = (Math.max(0, segment.value) / total) * 100;
                  const dash = Math.max(0, share - (shown.length > 1 ? GAP : 0));
                  const circle = (
                    <circle
                      key={segment.label}
                      cx="21"
                      cy="21"
                      r={RADIUS}
                      fill="none"
                      strokeWidth={6}
                      className={LOOKS[index]?.stroke}
                      strokeDasharray={`${dash} ${100 - dash}`}
                      strokeDashoffset={-offset}
                      data-segment={index + 1}
                    />
                  );
                  offset += share;
                  return circle;
                })
              : null}
          </svg>
          {centre === undefined ? null : (
            <div className="absolute inset-0 grid place-content-center text-center">{centre}</div>
          )}
        </div>
        <ul className="grid min-w-0 flex-1 gap-1.5">
          {shown.map((segment, index) => (
            <li
              key={segment.label}
              className="flex items-center gap-2 text-sm"
              data-segment={index + 1}
            >
              <svg
                viewBox="0 0 12 12"
                className="size-3 shrink-0"
                aria-hidden="true"
                focusable="false"
              >
                <path d={LOOKS[index]?.marker} className={LOOKS[index]?.fill} />
              </svg>
              <span className="min-w-0 flex-1 truncate">{segment.label}</span>
              <span className="tabular-nums">{segment.formatted}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
