import { Slot } from '@radix-ui/react-slot';
import type { ComponentType, ReactElement, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import { Skeleton } from '../skeleton/Skeleton';
import { StatusBadge, type BadgeTone } from '../status-badge/StatusBadge';
import type { PhotoSet } from './PhotoImage';
import { ProductPhoto, type PhotoTone } from './ProductPhoto';

type NonEmpty<T extends string> = T extends '' ? never : T;

export interface ProductCardProps<A extends string = string> {
  /**
   * The product's name as a link to its page, for example `<Link href="/p/goat">Goat</Link>`. The whole
   * card is its target: the link is stretched over it, so there is one tab stop per product.
   */
  nameLink: ReactElement;
  photo: PhotoSet | null;
  /** What the tile says with no photograph: usually the product's name. */
  photoLabel: string;
  placeholderIcon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: PhotoTone;
  /** The `sizes` of the photograph in this grid, for example "(min-width: 64rem) 25vw, 50vw". */
  photoSizes: string;
  /** The first row of a listing loads its photographs eagerly; every other card lazily. */
  eager?: boolean;
  /** The price, already formatted with `MoneyDisplay`, and what it buys: "GH₵26.00 per kg". */
  price: ReactNode;
  /** What one unit is, for example "A pack, about 15.000 kg". */
  unitLine?: ReactNode;
  /** Required. Whether it can be bought now, in words: never colour alone. */
  availability: { tone: BadgeTone; label: NonEmpty<A> };
  /** How it is sold when that is not plain: priced by weight, or by request. Shown with its icon. */
  note?: { icon: ComponentType<SVGProps<SVGSVGElement>>; text: string };
  className?: string;
}

/**
 * ProductCard (ADR 0040). A product in a listing: its photograph first, then its name, its price and what
 * it buys, whether it can be bought, and how it is charged when it is weighed. It shows the API's prices
 * as they come and computes nothing. The heading level is h3, inside a listing's h2 or h1.
 */
export function ProductCard<A extends string>({
  nameLink,
  photo,
  photoLabel,
  placeholderIcon,
  tone,
  photoSizes,
  eager = false,
  price,
  unitLine,
  availability,
  note,
  className,
}: ProductCardProps<A>) {
  const NoteIcon = note?.icon;
  return (
    <article
      data-slot="product-card"
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-fg shadow-sm',
        'transition-shadow duration-fast hover-enabled:shadow-md',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus',
        className,
      )}
    >
      <ProductPhoto
        photo={photo}
        placeholderIcon={placeholderIcon}
        placeholderLabel={photoLabel}
        tone={tone}
        sizes={photoSizes}
        eager={eager}
      />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-base leading-snug font-semibold text-balance">
          <Slot className="outline-none after:absolute after:inset-0 hover-enabled:underline">
            {nameLink}
          </Slot>
        </h3>
        <p className="text-lg">{price}</p>
        {unitLine === undefined ? null : <p className="text-sm text-fg-muted">{unitLine}</p>}
        {note === undefined || NoteIcon === undefined ? null : (
          <p className="flex items-start gap-1.5 text-sm text-accent-text">
            <NoteIcon
              aria-hidden="true"
              focusable="false"
              className="mt-0.5 size-icon-sm shrink-0"
            />
            <span>{note.text}</span>
          </p>
        )}
        <div className="mt-auto pt-1">
          <StatusBadge tone={availability.tone} label={availability.label} />
        </div>
      </div>
    </article>
  );
}

/** A card's shape while a listing loads: the tile, two lines and a badge. Announced once, by the grid. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="product-card-skeleton"
      aria-hidden="true"
      className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}
    >
      <Skeleton shape="block" className="aspect-square h-auto rounded-none" />
      <div className="grid gap-2 p-3">
        <Skeleton shape="line" className="w-3/4" />
        <Skeleton shape="line" className="w-1/2" />
        <Skeleton shape="line" className="w-1/3" />
      </div>
    </div>
  );
}
