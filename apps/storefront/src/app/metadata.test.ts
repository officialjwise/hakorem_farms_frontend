import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../lib/catalogue';
import robots from './robots';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the home page and every category with an absolute URL', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain('https://hakoremfarms.com/');
    for (const { slug } of CATEGORIES) expect(urls).toContain(`https://hakoremfarms.com/c/${slug}`);
    expect(urls).toHaveLength(CATEGORIES.length + 1);
  });

  it('never lists checkout or a product that does not exist', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes('/checkout') || url.includes('/p/'))).toBe(false);
  });
});

describe('robots', () => {
  it('keeps checkout out of search and points at the sitemap', () => {
    const result = robots();
    expect(result.sitemap).toBe('https://hakoremfarms.com/sitemap.xml');
    expect(JSON.stringify(result.rules)).toContain('/checkout');
  });
});
