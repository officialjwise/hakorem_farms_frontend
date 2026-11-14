/**
 * The category navigation. It is a fixed list of public routes, not API data: the catalogue endpoints
 * arrive through the generated client in F2 and the screens in F7, and those replace `getCategory`.
 * `key` selects the label in the `storefront` namespace.
 */
export const CATEGORIES = [
  { slug: 'live-animals', key: 'live' },
  { slug: 'meat', key: 'meat' },
  { slug: 'eggs', key: 'eggs' },
  { slug: 'produce', key: 'produce' },
  { slug: 'farm-inputs', key: 'inputs' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export function getCategory(slug: string): (typeof CATEGORIES)[number] | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

/**
 * A product by its URL slug. There is no catalogue to read until F2 and F7, so nothing exists yet and the
 * product route answers 404 honestly instead of inventing a product.
 */
export async function getProduct(slug: string): Promise<null> {
  void slug;
  return null;
}
