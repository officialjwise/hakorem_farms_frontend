import type { ComponentType, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import { PhotoImage, type PhotoSet } from './PhotoImage';

/** The warm tints a photograph's tile may wear, by product line. Each pairs a `-subtle` fill with a mark. */
export type PhotoTone = 'sand' | 'accent' | 'clay' | 'good';

/* Written out so Tailwind's scanner sees them; a `-subtle` surface and a mark token's stroke (ADR 0001). */
const TONE: Record<PhotoTone, { tile: string; icon: string }> = {
  sand: { tile: 'bg-warning-subtle', icon: 'stroke-series-2' },
  accent: { tile: 'bg-accent-subtle', icon: 'stroke-accent' },
  clay: { tile: 'bg-clay-subtle', icon: 'stroke-clay' },
  good: { tile: 'bg-good-subtle', icon: 'stroke-good' },
};

export interface ProductPhotoProps {
  /** The API's photograph, or null when the product has none. */
  photo: PhotoSet | null;
  /** Drawn on the tile when there is no photograph, or while it loads: the product line's line icon. */
  placeholderIcon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Required with no photograph: what the tile shows, for a screen reader, for example the product's name. */
  placeholderLabel: string;
  tone?: PhotoTone;
  sizes: string;
  eager?: boolean;
  /** `square` for cards, `wide` (4:3) for the product page on a phone. */
  shape?: 'square' | 'wide';
  className?: string;
}

/**
 * ProductPhoto (ADR 0040). A tile in a warm tint with the product line's icon, and the photograph over it.
 * On a slow connection the tile is what shows first; with no photograph, or one that fails, it is what
 * stays, never a broken image. It takes no copy of its own.
 */
export function ProductPhoto({
  photo,
  placeholderIcon: Icon,
  placeholderLabel,
  tone = 'sand',
  sizes,
  eager = false,
  shape = 'square',
  className,
}: ProductPhotoProps) {
  if (photo === null && placeholderLabel.trim() === '') {
    throw new Error('ProductPhoto needs a placeholderLabel when there is no photograph.');
  }
  const look = TONE[tone];
  return (
    <div
      data-slot="product-photo"
      data-has-photo={photo === null ? undefined : ''}
      className={cn(
        'relative grid place-items-center overflow-hidden',
        shape === 'square' ? 'aspect-square' : 'aspect-4/3',
        look.tile,
        className,
      )}
      {...(photo === null ? { role: 'img', 'aria-label': placeholderLabel } : {})}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        strokeWidth={1.25}
        className={cn('size-1/3', look.icon)}
      />
      {photo === null ? null : <PhotoImage photo={photo} sizes={sizes} eager={eager} />}
    </div>
  );
}
