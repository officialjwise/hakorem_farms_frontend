import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AskTheShop } from '../components/AskTheShop';
import { getT } from '../i18n/server';
import { getShopProfile } from '../lib/api';
import { mock } from '../test-integration-setup';
import { Root } from '../test-wrapper';
import CategoryLayout from './c/[slug]/layout';
import CategoryPage, { generateMetadata as categoryMetadata } from './c/[slug]/page';
import HomePage from './page';
import ProductPage, { generateMetadata as productMetadata } from './p/[slug]/page';
import SearchPage from './search/page';
import sitemap from './sitemap';

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

const params = (slug: string) => Promise.resolve({ slug });
const query = (values: Record<string, string> = {}) => Promise.resolve(values);

describe('the home page, against the real Prism', () => {
  it('names each category with its count, and lists what is in the shop with prices in words', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/straight from the farm/);
    const meat = screen.getByRole('link', { name: /Meat/ });
    expect(meat).toHaveAttribute('href', '/c/meat');
    expect(meat).toHaveTextContent('5 products');
    const list = screen.getByRole('list', { name: 'In the shop now' });
    const goat = within(list).getByRole('link', { name: 'Goat' });
    expect(goat).toHaveAttribute('href', '/p/goat');
    expect(list).toHaveTextContent('GH₵120.00');
    expect(list).toHaveTextContent('GH₵1,950.00');
    expect(list).toHaveTextContent('By request');
  });
});

describe('a category page', () => {
  it('an unknown category is a real 404, decided above the loading boundary', async () => {
    expect(
      await notFoundOf(() => CategoryLayout({ params: params('unicorns'), children: null })),
    ).toBe(true);
    expect(await notFoundOf(() => CategoryLayout({ params: params('meat'), children: null }))).toBe(
      false,
    );
  });

  it('its title, canonical address and Open Graph tags come from the API’s category', async () => {
    const meta = await categoryMetadata({ params: params('meat'), searchParams: query() });
    expect(meta.title).toBe('Meat');
    expect(meta.alternates?.canonical).toBe('/c/meat');
    expect(meta.openGraph).toMatchObject({ title: 'Meat', url: '/c/meat' });
  });

  it('lists the products, with the filters as links and the chosen one marked in words', async () => {
    render(
      await CategoryPage({
        params: params('meat'),
        searchParams: query({ availability: 'IN_STOCK' }),
      }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Meat' })).toBeInTheDocument();
    const filters = screen.getByRole('region', { name: 'Filter and sort' });
    const inStock = within(filters).getByRole('link', { name: 'In stock' });
    expect(inStock).toHaveAttribute('aria-current', 'true');
    expect(within(filters).getByRole('link', { name: 'Price, low to high' })).toHaveAttribute(
      'href',
      '/c/meat?availability=IN_STOCK&sort=PRICE_ASC',
    );
    expect(screen.getByRole('list', { name: 'Meat' })).toBeInTheDocument();
  });

  it('a catalogue that fails says so, with the reference and a retry to the same address', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/shop/catalogue';
    render(await CategoryPage({ params: params('meat'), searchParams: query({ sort: 'NAME' }) }));
    expect(screen.getByText('The products could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/quote this reference/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/c/meat?sort=NAME',
    );
  });
});

describe('search', () => {
  it('says what was searched, and lists the API’s results', async () => {
    render(await SearchPage({ searchParams: query({ q: 'goat' }) }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “goat”');
    expect(screen.getByRole('list', { name: 'Results for “goat”' })).toBeInTheDocument();
  });
});

describe('a product page', () => {
  it('a weighed product says how it is charged beside the price, with the API’s rule', async () => {
    render(await ProductPage({ params: params('goat-meat-15-kg-pack') }), { wrapper: Root });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Goat meat, 15 kg pack' }),
    ).toBeInTheDocument();
    const notice = screen.getByRole('region', { name: 'Priced by weight' });
    expect(notice).toHaveTextContent('Price per kg');
    expect(notice).toHaveTextContent('GH₵26.00');
    expect(notice).toHaveTextContent('15.000 kg');
    expect(notice).toHaveTextContent('10% more');
    expect(notice).toHaveTextContent(/you pay for the weighed amount/);
    expect(screen.getByRole('button', { name: /Add to basket/ })).toBeInTheDocument();
  });

  it('its metadata is the product’s own, with its photograph to share', async () => {
    const meta = await productMetadata({ params: params('goat-meat-15-kg-pack') });
    expect(meta.title).toEqual({ absolute: 'Goat meat, 15 kg pack | HaKorem Farms' });
    expect(meta.alternates?.canonical).toBe('/p/goat-meat-15-kg-pack');
    expect(JSON.stringify(meta.openGraph)).toContain('full.jpg');
  });

  it('a slug that is not listed is a real 404, from the metadata and from the page', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/shop/products/';
    expect(await notFoundOf(() => productMetadata({ params: params('unicorn') }))).toBe(true);
    expect(await notFoundOf(() => ProductPage({ params: params('unicorn') }))).toBe(true);
  });
});

describe('the sitemap', () => {
  it('lists the home page, the shop, each category and each product, never checkout', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://hakoremfarms.com/');
    expect(urls).toContain('https://hakoremfarms.com/c/meat');
    expect(urls).toContain('https://hakoremfarms.com/p/goat');
    expect(urls.some((url) => url.includes('/checkout'))).toBe(false);
  });
});

describe('asking the shop for a live animal (CR-028), against the real Prism', () => {
  it('gives the shop’s phone and WhatsApp from getShopProfile, as links a phone opens', async () => {
    const [t, profile] = await Promise.all([getT('storefront'), getShopProfile()]);
    render(<AskTheShop profile={profile} t={t} />, { wrapper: Root });
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Live animals are sold by request');
    expect(notice).toHaveTextContent(/call or WhatsApp the shop/);
    const contact = screen.getByRole('list', { name: 'Ask the shop' });
    expect(within(contact).getByRole('link', { name: 'Call 020 000 0120' })).toHaveAttribute(
      'href',
      'tel:+233200000120',
    );
    expect(
      within(contact).getByRole('link', { name: 'WhatsApp 020 000 0121, opens WhatsApp' }),
    ).toHaveAttribute('href', 'https://wa.me/233200000121');
  });

  it('with no business profile set (404), says to call or visit, and invents no number', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/shop/profile';
    const [t, profile] = await Promise.all([getT('storefront'), getShopProfile()]);
    expect(profile.ok).toBe(false);
    render(<AskTheShop profile={profile} t={t} />, { wrapper: Root });
    expect(screen.getByText(/visit the farm or call the shop/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
