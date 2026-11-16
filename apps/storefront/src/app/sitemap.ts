import type { MetadataRoute } from 'next';
import { getShopCategories, load } from '../lib/api';
import { categorySlug } from '../lib/shop';
import { SITE_URL } from '../lib/site';

/** Read per request, so a new product is listed without a rebuild. */
export const dynamic = 'force-dynamic';

/** How many products the sitemap lists: the first pages of the catalogue, one read. */
const PRODUCTS = 100;

/**
 * The public routes: the home page, the whole shop, each category the API lists, and the catalogue's
 * products. Checkout and anything behind a session never appear. If the catalogue cannot be read, the
 * sitemap still lists the home page and the shop, never an invented URL.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    getShopCategories(),
    load('listCatalogue', { query: { limit: PRODUCTS } }),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'daily', priority: 0.8 },
    ...(categories.ok ? categories.data.data : []).map((category) => ({
      url: `${SITE_URL}/c/${categorySlug(category.code)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...(products.ok ? products.data.data : []).map((product) => ({
      url: `${SITE_URL}/p/${product.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ];
}
