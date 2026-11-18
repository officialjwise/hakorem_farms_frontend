'use client';

import { useEffect, useRef, useState } from 'react';

/** One width of a product photograph, as the contract's ImageVariant gives it: WebP, with a JPEG fallback. */
export interface PhotoVariant {
  variant: 'thumb' | 'card' | 'full';
  url: string;
  width: number;
  height: number;
  fallbackUrl: string;
}

/** A photograph and its widths, as the contract's ImageSet gives it. */
export interface PhotoSet {
  alt: string;
  variants: readonly PhotoVariant[];
}

export interface PhotoImageProps {
  photo: PhotoSet;
  /** The `sizes` attribute: how wide the photograph is drawn, so the browser picks the smallest width. */
  sizes: string;
  /** Only the largest photograph above the fold loads eagerly; every other one waits until it is near. */
  eager?: boolean;
}

/**
 * The photograph itself: a `<picture>` with the WebP widths and the JPEG fallback, width and height set so
 * nothing shifts. A client leaf for one reason: a photograph that fails to load (a missing file, a dropped
 * connection) is removed, so the tile under it shows instead of a broken image. One that failed before
 * hydration is caught on mount.
 *
 * Its classes are fixed and take no `className`: `cn` would bring tailwind-merge and the token list into
 * every storefront listing page's first load (12 kB gzipped), for one leaf that has nothing to merge.
 */
export function PhotoImage({ photo, sizes, eager = false }: PhotoImageProps) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (element !== null && element.complete && element.naturalWidth === 0) setFailed(true);
  }, []);
  const variants = [...photo.variants].sort((a, b) => a.width - b.width);
  const largest = variants.at(-1);
  if (failed || largest === undefined) return null;
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={variants.map((v) => `${v.url} ${v.width}w`).join(', ')}
        sizes={sizes}
      />
      <img
        ref={image}
        src={largest.fallbackUrl}
        srcSet={variants.map((v) => `${v.fallbackUrl} ${v.width}w`).join(', ')}
        sizes={sizes}
        width={largest.width}
        height={largest.height}
        alt={photo.alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
