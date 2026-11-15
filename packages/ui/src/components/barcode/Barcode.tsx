import { cn } from '../../lib/cn';
import { code128BWidths } from './code128';

export type BarcodeProps = {
  /** The text the barcode encodes: a product barcode, SKU or lot identifier (printable ASCII). */
  value: string;
  /** What the code is, for a screen reader, such as "Lot barcode". The value is read after it. */
  label: string;
  /** Print the value in words under the bars, as scanners' users expect. */
  showValue?: boolean;
  className?: string;
};

const QUIET = 10;

/**
 * Barcode. A Code 128 (set B) barcode drawn as SVG, dark bars on the label's light ground. It encodes; it
 * decides nothing about what goes on a label. Render it inside a light-theme label so it scans in print.
 */
export function Barcode({ value, label, showValue = true, className }: BarcodeProps) {
  const widths = code128BWidths(value);
  const modules = widths.reduce((sum, w) => sum + w, 0) + QUIET * 2;
  let x = QUIET;
  const bars: { x: number; w: number }[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return (
    <span data-slot="barcode" className={cn('inline-grid justify-items-center gap-0.5', className)}>
      <svg
        role="img"
        aria-label={`${label}: ${value}`}
        viewBox={`0 0 ${modules} 40`}
        preserveAspectRatio="none"
        className="h-12 w-full max-w-64 text-fg"
        shapeRendering="crispEdges"
      >
        {bars.map((bar) => (
          <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} fill="currentColor" />
        ))}
      </svg>
      {showValue ? (
        <span aria-hidden="true" className="font-mono text-xs tracking-wider text-fg">
          {value}
        </span>
      ) : null}
    </span>
  );
}
