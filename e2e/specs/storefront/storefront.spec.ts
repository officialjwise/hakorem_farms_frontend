import { expect, test } from '../../support/test';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';

test.describe('public shell', () => {
  test('home: header, category navigation, footer, one h1, and the skip link works', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fresh from our farm in Dodowa',
    );
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Shop by category' }).getByRole('link'),
    ).toHaveCount(5);
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test('a category page shows its empty state; an unknown category is a not-found page kept out of search', async ({
    page,
    request,
  }) => {
    await page.goto('/c/meat');
    await expect(page.getByRole('heading', { level: 1, name: 'Meat' })).toBeVisible();
    await expect(page.getByText('Products arrive soon')).toBeVisible();
    await expect(page).toHaveTitle('Meat | HaKorem Farms');
    // The route streams behind loading.tsx, so the status line is already sent as 200. Next marks such a
    // page noindex, which is what keeps it out of search (ADR 0015); F7 moves the lookup above its Suspense.
    await page.goto('/c/unicorns');
    await expect(page.getByText('Page not found')).toBeVisible();
    const html = await (await request.get('/c/unicorns')).text();
    expect(html).toContain('<meta name="robots" content="noindex"/>');
  });

  test('a product that does not exist is a 404 page, never an invented product', async ({
    page,
  }) => {
    await page.goto('/p/goat-meat');
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('checkout is a skeleton: words, a way back, and kept out of search', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('Your cart is not charged')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('cart drawer', () => {
  test('opens from the header, says it is empty, and Escape closes it back onto the trigger', async ({
    page,
  }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Cart, 0 items' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Your cart' });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Your cart is empty');
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the checkout link goes to checkout and closes the drawer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Cart, 0 items' }).click();
    await page.getByRole('link', { name: 'Go to checkout' }).click();
    await expect(page).toHaveURL('/checkout');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('metadata, Open Graph, sitemap', () => {
  test('home carries title, description, canonical and Open Graph tags', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('HaKorem Farms');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /HaKorem Farms/,
    );
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

  test('a category carries its own title and Open Graph url', async ({ page }) => {
    await page.goto('/c/eggs');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Eggs');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://hakoremfarms.com/c/eggs',
    );
  });

  test('serves a sitemap and robots.txt', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://hakoremfarms.com/c/live-animals</loc>');
    expect(sitemap).not.toContain('/checkout');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /checkout');
    expect(robots).toContain('Sitemap: https://hakoremfarms.com/sitemap.xml');
  });
});

test.describe('theme on <html>, server side (ADR 0015)', () => {
  test('the first byte already carries data-theme from the cookie, so there is no flash', async ({
    request,
  }) => {
    const dark = await (await request.get('/', { headers: { cookie: 'hk_theme=dark' } })).text();
    expect(dark).toMatch(/<html[^>]*data-theme="dark"/);
    const none = await (await request.get('/')).text();
    expect(none).not.toMatch(/<html[^>]*data-theme/);
    expect(none).toMatch(/<html[^>]*data-density="comfortable"/);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      '/',
      '/c/meat',
      '/c/live-animals',
      '/checkout',
      '/p/anything',
      '/nowhere',
    ]) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        await page.getByRole('main').waitFor();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}
