import { describe, expect, it } from 'vitest';
import CategoryPage, { generateMetadata, generateStaticParams } from './c/[slug]/page';
import ProductPage from './p/[slug]/page';
import { CATEGORIES } from '../lib/catalogue';

/** Next signals notFound() by throwing an error whose digest starts with this. */
async function notFoundOf(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: unknown }).digest).startsWith(
      'NEXT_HTTP_ERROR_FALLBACK;404',
    );
  }
  return false;
}

describe('category route', () => {
  it('pre-renders every category', () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(CATEGORIES.map((c) => c.slug));
  });

  it('answers a real 404 for a category that does not exist', async () => {
    expect(
      await notFoundOf(() => CategoryPage({ params: Promise.resolve({ slug: 'unicorns' }) })),
    ).toBe(true);
  });

  it('builds a title, a canonical URL and Open Graph tags for a category', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'meat' }) });
    expect(meta.title).toBe('Meat');
    expect(meta.alternates?.canonical).toBe('/c/meat');
    expect(meta.openGraph).toMatchObject({ title: 'Meat', url: '/c/meat' });
    expect(meta.description).toMatch(/Meat/);
  });

  it('gives no metadata for an unknown category', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'nope' }) })).toEqual({});
  });
});

describe('product route', () => {
  it('answers 404 for every slug until the catalogue is connected, rather than inventing a product', async () => {
    expect(
      await notFoundOf(() => ProductPage({ params: Promise.resolve({ slug: 'goat-meat' }) })),
    ).toBe(true);
  });
});
