import {
  Beef,
  Bird,
  Carrot,
  Drumstick,
  Egg,
  Package,
  PawPrint,
  Sprout,
  Truck,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { components } from '@hakorem/api-client';
import type { BadgeTone, PhotoSet, PhotoTone } from '@hakorem/ui';

type S = components['schemas'];
export type CatalogueItem = S['CatalogueItem'];
export type ProductDetail = S['ProductDetail'];
export type ShopCategory = S['ShopCategory'];
export type Availability = CatalogueItem['availability'];
export type ProductLine = S['ProductLine'];

/** Availability in words and a tone: never the quantity, which the API never sends (FR-SHP-002). */
export const AVAILABILITY: Record<Availability, BadgeTone> = {
  IN_STOCK: 'good',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'slate',
  ON_REQUEST: 'info',
};

/** The tile a product shows before its photograph, or without one: its line's icon on a warm tint. */
const LINE: Record<ProductLine, { icon: LucideIcon; tone: PhotoTone }> = {
  LIVE: { icon: PawPrint, tone: 'good' },
  MEAT: { icon: Beef, tone: 'clay' },
  PRODUCE: { icon: Carrot, tone: 'good' },
  BY_PRODUCT: { icon: Drumstick, tone: 'clay' },
  FEED: { icon: Wheat, tone: 'sand' },
  SUPPLY: { icon: Package, tone: 'sand' },
  SERVICE: { icon: Truck, tone: 'accent' },
};

/**
 * The tile for a product. Presentation only: poultry and eggs get their own icon when the category path
 * names them, since the product line alone says "live" or "produce".
 */
export function tileFor(item: Pick<CatalogueItem, 'productLine' | 'categoryPath' | 'name'>): {
  icon: LucideIcon;
  tone: PhotoTone;
} {
  const words = [...item.categoryPath, item.name].join(' ').toLowerCase();
  if (words.includes('egg')) return { icon: Egg, tone: 'sand' };
  if (item.productLine === 'LIVE' && /poultry|chicken|duck|bird/.test(words)) {
    return { icon: Bird, tone: 'good' };
  }
  return LINE[item.productLine] ?? { icon: Sprout, tone: 'sand' };
}

/** The tile for a basket line, which carries only the product's name: by the words in it. */
export function tileForName(name: string): { icon: LucideIcon; tone: PhotoTone } {
  const words = name.toLowerCase();
  if (words.includes('egg')) return { icon: Egg, tone: 'sand' };
  if (/meat|beef|pork|chicken|goat|wing|drumstick|thigh|back/.test(words)) {
    return { icon: Beef, tone: 'clay' };
  }
  return { icon: Sprout, tone: 'good' };
}

/** A category's tile on the home page, by its code and name. Presentation only, with a plain default. */
export function categoryIcon(category: Pick<ShopCategory, 'code' | 'name'>): LucideIcon {
  const words = `${category.code} ${category.name}`.toLowerCase();
  if (words.includes('egg')) return Egg;
  if (/poultry|chicken|bird/.test(words)) return Bird;
  if (/live|animal|goat|sheep/.test(words)) return PawPrint;
  if (/meat|beef|pork/.test(words)) return Beef;
  if (/produce|vegetable|fruit/.test(words)) return Carrot;
  if (/feed|input/.test(words)) return Wheat;
  return Sprout;
}

/** A category's address: its code in lower case, `/c/live-animals` style. */
export function categorySlug(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
}

/** The category a slug names, among the shop's categories, or undefined. */
export function categoryBySlug(
  categories: readonly ShopCategory[],
  slug: string,
): ShopCategory | undefined {
  return categories.find((category) => categorySlug(category.code) === slug);
}

/** The photograph a card shows: the API's thumb and card widths, never the full one in a grid. */
export function cardPhoto(image: S['ImageSet'] | null): PhotoSet | null {
  if (image === null) return null;
  const variants = image.variants.filter((v) => v.variant !== 'full');
  return { alt: image.alt, variants: variants.length > 0 ? variants : image.variants };
}

/** The `sizes` of a photograph in the product grid: two across on a phone, three, then four. */
export const GRID_PHOTO_SIZES = '(min-width: 64rem) 16rem, (min-width: 40rem) 33vw, 50vw';

/** The listing's page size: two rows of four at 1280 px, four rows of two on a phone. */
export const PAGE_SIZE = 12;

/** The orders a listing may be sorted in: the contract's `sort` values (CR-019). */
export const SORTS = ['RELEVANCE', 'PRICE_ASC', 'PRICE_DESC', 'NAME'] as const;
export type Sort = (typeof SORTS)[number];
export const AVAILABILITIES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ON_REQUEST'] as const;

/** A query-string value, or undefined when it is not one of the allowed values. */
export function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}
