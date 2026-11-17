import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './test';

/**
 * The storefront against the Prism mock: its server reads the catalogue, and its browser talks for the cart
 * and checkout, through the shop API in front of Prism (HK_API_BASE_URL=http://127.0.0.1:4011 at build,
 * ADR 0054). The mock's product photographs are on the real media origin, which a test must not depend on:
 * they are refused, so every card shows its tile, as it does for a product with no photograph.
 */
export async function refusePhotos(context: BrowserContext): Promise<void> {
  await context.route('https://media.hakoremfarms.com/**', (route) => route.abort());
}

/** The cart in the contract's examples: a weighed pack of chicken and two crates of eggs. */
export const EXAMPLE_CART = '019a7aa9-1c15-7ae4-b01c-b713eac82ff1';

/** Starts the page with that cart remembered, as if it had been filled earlier. */
export async function withCart(page: Page): Promise<void> {
  await page.addInitScript((id) => window.localStorage.setItem('hk_cart', id), EXAMPLE_CART);
}

/** Fills the checkout's details for a delivery to Madina, checks delivery and picks the first open slot. */
export async function fillDetails(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: /Your name/ }).fill('Ama Serwaa Ofori');
  await page.getByRole('textbox', { name: /Phone number/ }).fill('024 451 2876');
  await page
    .getByRole('textbox', { name: /House number and street/ })
    .fill('House 14, Ashaley Botwe Road');
  await page.getByRole('textbox', { name: /Area or suburb/ }).fill('Madina');
  await page.getByRole('textbox', { name: /Town or city/ }).fill('Accra');
  await page.getByRole('button', { name: 'Check delivery to this address' }).click();
  await expect(page.getByText(/We deliver to Accra East/)).toBeVisible();
  await page.getByRole('radio', { name: 'Saturday 14 November, 10:00 to 12:00' }).check();
}

/** Simulated slow 3G on a cheap phone, the brief's floor: 300 ms round trip, 700 Kbps down, 4x CPU. */
export async function throttle3G(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 300,
    downloadThroughput: (700 * 1000) / 8,
    uploadThroughput: (700 * 1000) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}
