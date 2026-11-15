'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { columnCentre, heightOf, niceMax, ticks } from './scale';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface ChartSeries {
  /** Required. The series' name in words, for the legend and the table. */
  label: string;
  /** One value per category, in the series' own unit (pesewas, a count). Geometry only. */
  values: readonly number[];
  /** The same values, already formatted for people (formatMoney, a count with its unit). */
  formatted: readonly string[];
}

export type BarTone = 'accent' | 'series-2' | 'good' | 'warning' | 'critical';

interface ChartBaseProps<T extends string> {
  /** Required. The chart's title in words. */
  title: NonEmpty<T>;
  /** One sentence that says what the chart shows, read before the picture. */
  summary: string;
  /** The x axis: one label per column. */
  categories: readonly string[];
  /** One series, or two: the first is the accent, the second the sand. Never more (one accent rule). */
  series: readonly [ChartSeries] | readonly [ChartSeries, ChartSeries];
  /** Formats a y-axis tick value for people. */
  formatTick: (value: number) => string;
  /** The disclosure that opens the figures as a table, such as "Show the figures". */
  tableLabel: string;
  /** The table's first column heading, such as "Day". */
  categoryHeader: string;
  /** Height of the plot. */
  size?: 'sm' | 'md';
  /** Hide the heading (when a card around the chart already has one); it stays as the figure's name. */
  hideTitle?: boolean;
  className?: string;
}

const PLOT_HEIGHT = { sm: 'h-28', md: 'h-48' } as const;

/** Stroke, fill and marker per series: hue, plus line style and marker shape, so it reads without colour. */
const LINE = [
  { stroke: 'stroke-accent', area: 'fill-series-1-area', dash: undefined, cap: 'round' as const },
  { stroke: 'stroke-series-2', area: 'fill-series-2-area', dash: '6 4', cap: 'square' as const },
];
const BAR_FILL: Record<BarTone, string> = {
  accent: 'fill-accent',
  'series-2': 'fill-series-2',
  good: 'fill-good',
  warning: 'fill-warning',
  critical: 'fill-critical',
};

function useChartGeometry(series: ChartBaseProps<string>['series']) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const top = niceMax(max);
  return { top, tickValues: ticks(top) };
}

/** The frame both charts share: title, summary, legend, y axis, x axis and the table of figures. */
function ChartFrame({
  title,
  summary,
  categories,
  series,
  formatTick,
  tableLabel,
  categoryHeader,
  size = 'md',
  hideTitle = false,
  className,
  legend,
  top,
  tickValues,
  kind,
  children,
}: ChartBaseProps<string> & {
  legend: ReactNode;
  top: number;
  tickValues: number[];
  kind: 'line' | 'bar';
  children: ReactNode;
}) {
  const titleId = useId();
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);
  if (title.trim() === '') throw new Error('A chart needs a non-empty title.');
  return (
    <figure
      data-slot="chart"
      data-kind={kind}
      aria-labelledby={titleId}
      className={cn('grid min-w-0 gap-2', className)}
    >
      <figcaption className="grid gap-0.5">
        <span id={titleId} className={cn('font-semibold', hideTitle && 'sr-only')}>
          {title}
        </span>
        <span className="text-control-sm text-fg-muted">{summary}</span>
      </figcaption>
      {series.length > 1 ? legend : null}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2" aria-hidden="true">
        <div className={cn('relative w-12', PLOT_HEIGHT[size])}>
          {tickValues.map((value) => (
            <span
              key={value}
              className="absolute end-0 translate-y-1/2 text-xs text-fg-muted tabular-nums"
              style={{ bottom: `${heightOf(value, top)}%` }}
            >
              {formatTick(value)}
            </span>
          ))}
        </div>
        <div className={cn('relative', PLOT_HEIGHT[size])}>
          {tickValues.map((value) => (
            <span
              key={value}
              className="absolute inset-x-0 border-t border-border"
              style={{ bottom: `${heightOf(value, top)}%` }}
            />
          ))}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            focusable="false"
          >
            {children}
          </svg>
        </div>
        <span />
        <div
          className="grid pt-1 text-xs text-fg-muted"
          style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
        >
          {categories.map((category) => (
            <span key={category} className="truncate text-center">
              {category}
            </span>
          ))}
        </div>
      </div>
      <div className="text-sm">
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((open) => !open)}
          className="w-fit cursor-pointer text-accent-text underline outline-focus outline-offset-2 focus-visible:outline-2"
        >
          {tableLabel}
        </button>
        <div id={tableId} hidden={!showTable} className="mt-2 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 pe-3 text-start font-semibold">
                  {categoryHeader}
                </th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="py-1 ps-3 text-end font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, row) => (
                <tr key={category} className="border-b border-border">
                  <th scope="row" className="py-1 pe-3 text-start font-normal">
                    {category}
                  </th>
                  {series.map((s) => (
                    <td key={s.label} className="py-1 ps-3 text-end tabular-nums">
                      {s.formatted[row]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  );
}

/** A legend whose swatches repeat each series' line style and marker, or bar pattern. */
function Legend({ series, kind }: { series: readonly ChartSeries[]; kind: 'line' | 'bar' }) {
  const patternId = useId();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-control-sm">
      {series.map((s, index) => (
        <li key={s.label} className="flex items-center gap-1.5" data-series={index + 1}>
          <svg
            viewBox="0 0 24 12"
            className="h-3 w-6 shrink-0"
            aria-hidden="true"
            focusable="false"
          >
            {kind === 'line' ? (
              <>
                <path
                  d="M1 6 H23"
                  className={LINE[index]?.stroke}
                  strokeWidth={2}
                  strokeDasharray={LINE[index]?.dash}
                />
                <path
                  d="M12 6 h0"
                  className={LINE[index]?.stroke}
                  strokeWidth={7}
                  strokeLinecap={LINE[index]?.cap}
                />
              </>
            ) : (
              <>
                {index === 1 ? <HatchPattern id={patternId} /> : null}
                <rect
                  x="4"
                  y="0"
                  width="16"
                  height="12"
                  className={index === 0 ? 'fill-accent' : 'fill-series-2'}
                />
                {index === 1 ? (
                  <rect x="4" y="0" width="16" height="12" fill={`url(#${patternId})`} />
                ) : null}
              </>
            )}
          </svg>
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Diagonal lines over the second series' bars: a pattern as well as a hue. */
function HatchPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width="4"
        height="4"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <path d="M0 0 V4" className="stroke-series-2-area" strokeWidth={1.5} />
      </pattern>
    </defs>
  );
}

export type LineChartProps<T extends string = string> = ChartBaseProps<T>;

/**
 * LineChart. One or two series over categories (days, weeks). The first series is a solid accent line with
 * round markers over a tinted area; the second a dashed sand line with square markers. Every figure is also
 * in a table one tap away.
 */
export function LineChart<T extends string>(props: LineChartProps<T>) {
  const { series, categories } = props;
  const { top, tickValues } = useChartGeometry(series);
  const n = categories.length;
  return (
    <ChartFrame
      {...props}
      kind="line"
      top={top}
      tickValues={tickValues}
      legend={<Legend series={series} kind="line" />}
    >
      {series.map((s, index) => {
        const look = LINE[index] ?? LINE[0];
        const points = s.values.map(
          (value, i) => [columnCentre(i, n), 100 - heightOf(value, top)] as const,
        );
        if (points.length === 0 || look === undefined) return null;
        const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
        const first = points[0];
        const last = points[points.length - 1];
        const area =
          first === undefined || last === undefined
            ? ''
            : `${line} L${last[0]} 100 L${first[0]} 100 Z`;
        return (
          <g key={s.label} data-series={index + 1}>
            {/* Only the first series' area is drawn, so the two never hide each other. */}
            {index === 0 ? <path d={area} className={look.area} /> : null}
            <path
              d={line}
              fill="none"
              className={look.stroke}
              strokeWidth={2.5}
              strokeDasharray={look.dash}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map(([x, y], i) => (
              <path
                key={i}
                d={`M${x} ${y} h0`}
                className={look.stroke}
                strokeWidth={8}
                strokeLinecap={look.cap}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </ChartFrame>
  );
}

export type BarChartProps<T extends string = string> = ChartBaseProps<T> & {
  /** One series only: a tone per bar, for categories that are themselves states (low, available, out). */
  barTones?: readonly BarTone[];
};

/**
 * BarChart. Grouped bars per category. The first series is solid accent; the second sand with diagonal
 * hatching, so the two differ in pattern as well as hue. A single series may give each bar its own tone
 * when the categories are states; the x labels then name them.
 */
export function BarChart<T extends string>({ barTones, ...props }: BarChartProps<T>) {
  const { series, categories } = props;
  const { top, tickValues } = useChartGeometry(series);
  const patternId = useId();
  const n = categories.length;
  const groupWidth = (100 / Math.max(n, 1)) * 0.64;
  const barWidth = groupWidth / series.length;
  return (
    <ChartFrame
      {...props}
      kind="bar"
      top={top}
      tickValues={tickValues}
      legend={<Legend series={series} kind="bar" />}
    >
      {series.length > 1 ? <HatchPattern id={patternId} /> : null}
      {series.map((s, index) => (
        <g key={s.label} data-series={index + 1}>
          {s.values.map((value, i) => {
            const h = heightOf(value, top);
            const x = columnCentre(i, n) - groupWidth / 2 + index * barWidth;
            const tone: BarTone =
              series.length === 1
                ? (barTones?.[i] ?? 'accent')
                : index === 0
                  ? 'accent'
                  : 'series-2';
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={100 - h}
                  width={barWidth * 0.92}
                  height={h}
                  className={BAR_FILL[tone]}
                />
                {index === 1 ? (
                  <rect
                    x={x}
                    y={100 - h}
                    width={barWidth * 0.92}
                    height={h}
                    fill={`url(#${patternId})`}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      ))}
    </ChartFrame>
  );
}
