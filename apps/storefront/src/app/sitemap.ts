import type { MetadataRoute } from 'next';
import { CATEGORIES } from '../lib/catalogue';
import { SITE_URL } from '../lib/site';

/**
 * The sitemap lists the public routes. Product URLs join it when the catalogue is connected (F7). Checkout
 * and anything behind a session never appear.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...CATEGORIES.map(({ slug }) => ({
      url: `${SITE_URL}/c/${slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
