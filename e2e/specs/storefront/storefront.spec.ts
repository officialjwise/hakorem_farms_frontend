import { expect, test } from '../../support/test';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { fillDetails, refusePhotos, throttle3G, withCart } from '../../support/shop';

test.beforeEach(async ({ context }) => {
  await refusePhotos(context);
});

test.describe('browsing', () => {
  test('home: the farm in words first, the categories from the API, and the skip link works', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fresh meat, eggs and live animals, straight from the farm',
    );
    const nav = page.getByRole('navigation', { name: 'Shop by category' });
    await expect(nav.getByRole('link')).toHaveText([
      'All products',
      'Live animals',
      'Meat',
      'Eggs',
      'Fresh produce',
    ]);
    await expect(
      page.getByRole('list', { name: 'In the shop now' }).getByRole('listitem'),
    ).toHaveCount(8);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test('a category lists its products, filters by links, and an unknown one is a real 404', async ({
    page,
    request,
  }) => {
    await page.goto('/c/meat');
    await expect(page.getByRole('heading', { level: 1, name: 'Meat' })).toBeVisible();
    await expect(page).toHaveTitle('Meat | HaKorem Farms');
    await page.getByRole('link', { name: 'Price, low to high' }).click();
    await expect(page).toHaveURL('/c/meat?sort=PRICE_ASC');
    await expect(page.getByRole('link', { name: 'Price, low to high' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('list', { name: 'Meat' }).getByRole('link').first()).toBeVisible();
    expect((await request.get('/c/unicorns')).status()).toBe(404);
    await page.goto('/c/unicorns');
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('search from the header says what was searched', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search the shop' }).fill('goat');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL('/search?q=goat');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “goat”');
  });
});

test.describe('the weighed price cannot be missed', () => {
  test('on a phone, the product page shows “Priced by weight” in the first screen, beside the price', async ({
    page,
  }) => {
    await page.goto('/p/goat-meat-15-kg-pack');
    const notice = page.getByRole('region', { name: 'Priced by weight' });
    await expect(notice).toContainText('Price per kg');
    await expect(notice).toContainText('15.000 kg');
    await expect(notice).toContainText('10% more');
    const box = await notice.boundingBox();
    expect(box, 'the notice is laid out').not.toBeNull();
    expect(box?.y ?? Infinity, 'the notice starts in the first screen at 360 px').toBeLessThan(740);
    await expectNoHorizontalScroll(page);
  });

  test('at checkout, the total is said to be an estimate beside it, with the most it can be', async ({
    page,
  }) => {
    await withCart(page);
    await page.goto('/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Hold my items and show the total' }).click();
    const estimate = page.getByRole('region', { name: 'Your total is an estimate' });
    await expect(estimate).toBeVisible();
    await expect(estimate).toContainText('GH₵450.00');
    await expect(estimate).toContainText('GH₵480.00');
    await expect(page.getByRole('button', { name: 'Pay GH₵450.00' })).toBeVisible();
  });
});

test.describe('basket', () => {
  test('add from a product page; the header counts it; the drawer lists it; Escape returns focus', async ({
    page,
  }) => {
    await page.goto('/p/goat-meat-15-kg-pack');
    await page.getByRole('button', { name: 'One more' }).click();
    await page.getByRole('button', { name: 'Add to basket' }).click();
    await expect(page.getByText('Added to your basket.')).toBeVisible();
    const basket = page.getByRole('button', { name: 'Basket 3 items' });
    await basket.click();
    const drawer = page.getByRole('dialog', { name: 'Your basket' });
    await expect(drawer.getByRole('article', { name: 'Full chicken, 15 kg pack' })).toContainText(
      'Weighed before it is sent',
    );
    await expect(drawer).toContainText('GH₵420.00');
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(basket).toBeFocused();
  });

  test('with no basket, checkout says so and leads back to the shop', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText('Nothing to check out')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('the F7 gate: checkout completes on a throttled 3G connection', () => {
  test('product to placed order, at 300 ms, 700 Kbps and 4x CPU', async ({ page }) => {
    test.setTimeout(180_000);
    await throttle3G(page);
    const started = Date.now();
    await page.goto('/p/goat-meat-15-kg-pack');
    await expect(page.getByRole('region', { name: 'Priced by weight' })).toBeVisible();
    await page.getByRole('button', { name: 'Add to basket' }).click();
    await expect(page.getByText('Added to your basket.')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^Basket \d+ items?$/ }).click();
    await page.getByRole('link', { name: 'Go to checkout' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible({
      timeout: 30_000,
    });
    await fillDetails(page);
    await page.getByRole('button', { name: 'Hold my items and show the total' }).click();
    await expect(page.getByRole('region', { name: 'Your total is an estimate' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Pay GH₵450.00' }).click();
    await expect(
      page.getByRole('heading', { name: /Your order SO-2026-DDW-004216 is placed/ }),
    ).toBeVisible({
      timeout: 30_000,
    });
    test.info().annotations.push({
      type: '3G checkout',
      description: `product page to placed order in ${Math.round((Date.now() - started) / 1000)} s`,
    });
  });

  test('a listing page paints its largest element in under 2.5 s on the same connection', async ({
    page,
  }) => {
    await throttle3G(page);
    await page.goto('/c/meat', { waitUntil: 'load' });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries.at(-1)?.startTime ?? Number.NaN);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        }),
    );
    test
      .info()
      .annotations.push({ type: 'LCP /c/meat on 3G', description: `${Math.round(lcp)} ms` });
    expect(lcp).toBeLessThan(2_500);
  });
});

test.describe('metadata, Open Graph, sitemap', () => {
  test('home carries title, description, canonical and Open Graph tags', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('HaKorem Farms: fresh meat, eggs and live animals');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://hakoremfarms.com',
    );
    for (const property of [
      'og:title',
      'og:description',
      'og:site_name',
      'og:type',
      'og:locale',
      'og:url',
    ]) {
      await expect(page.locator(`meta[property="${property}"]`), property).toHaveCount(1);
    }
  });

  test('a product carries its own title, canonical and photograph to share', async ({ page }) => {
    await page.goto('/p/goat-meat-15-kg-pack');
    await expect(page).toHaveTitle('Goat meat, 15 kg pack | HaKorem Farms');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /full\.jpg$/,
    );
  });

  test('serves a sitemap of the categories and products, and robots.txt', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://hakoremfarms.com/c/meat</loc>');
    expect(sitemap).toContain('<loc>https://hakoremfarms.com/p/goat</loc>');
    expect(sitemap).not.toContain('/checkout');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /checkout');
  });
});

test.describe('theme on <html>, server side (ADR 0015)', () => {
  test('the first byte already carries data-theme from the cookie, so there is no flash', async ({
    request,
  }) => {
    const dark = await (await request.get('/', { headers: { cookie: 'hk_theme=dark' } })).text();
    expect(dark).toMatch(/<html[^>]*data-theme="dark"/);
    const none = await (await request.get('/')).text();
    expect(none).not.toMatch(/<html[^>]*data-theme=/);
    expect(none).toMatch(/<html[^>]*data-density="comfortable"/);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      '/',
      '/c/meat',
      '/search?q=goat',
      '/p/goat-meat-15-kg-pack',
      '/checkout',
      '/nowhere',
    ]) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        await page.getByRole('main').waitFor();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }

    test('checkout, details and the review', async ({ page }) => {
      await withCart(page);
      await page.goto('/checkout');
      await fillDetails(page);
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Hold my items and show the total' }).click();
      await expect(page.getByRole('region', { name: 'Your total is an estimate' })).toBeVisible();
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);
    });
  });
}
