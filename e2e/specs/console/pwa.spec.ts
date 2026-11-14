import { expect, test } from '../../support/test';

test.describe('installable PWA', () => {
  test('links a manifest with the fields an install needs, and its icons load', async ({
    page,
    request,
  }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      display: 'standalone',
      start_url: '/',
      scope: '/',
      name: 'HaKorem Farms console',
    });
    const sizes = manifest.icons.map(
      (icon: { sizes: string; purpose: string }) => `${icon.sizes}:${icon.purpose}`,
    );
    expect(sizes).toEqual(
      expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']),
    );
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.ok(), icon.src).toBe(true);
    }
  });

  test('registers a service worker in the production build', async ({ page }) => {
    await page.goto('/login');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe('http://localhost:4173/');
  });
});
