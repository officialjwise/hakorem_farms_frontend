import { expect, test, type Locator, type Page } from '../../support/test';
import { signIn, USERS } from '../../support/helpers';

/**
 * THE REQUIRED F1 TEST (docs/BUILD_PROMPT.md F1, ADR 0004, ADR 0014): the POS barcode focus trap and an open
 * Dialog together, in Chromium, against the REAL shell, the REAL trap and the REAL Radix Dialog from
 * @hakorem/ui. Nothing here is a stand-in. Focus must stay in the Dialog while it is open, and return to the
 * barcode field, not to the button that opened it, when it closes.
 */

const SCAN = '4006381333931';

async function openPos(page: Page) {
  await signIn(page, USERS.cashier, '/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
  return page.getByLabel('Barcode');
}

/** True when the focused element is inside the locator. */
function focusIsInside(locator: Locator) {
  return locator.evaluate((root) => root.contains(document.activeElement));
}

test.describe('POS barcode focus trap', () => {
  test('the barcode field owns focus on arrival, and a scan lands in it', async ({ page }) => {
    const barcode = await openPos(page);
    await expect(barcode).toBeFocused();
    await page.keyboard.type(SCAN);
    await expect(barcode).toHaveValue(SCAN);
    await page.keyboard.press('Enter');
    await expect(page.getByText(`Last scan: ${SCAN}`)).toBeVisible();
    await expect(barcode).toHaveValue('');
    await expect(barcode).toBeFocused();
  });

  test('a click on empty space does not lose the scanner: focus comes back', async ({ page }) => {
    const barcode = await openPos(page);
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await expect(barcode).toBeFocused();
    await page.keyboard.type('12345');
    await expect(barcode).toHaveValue('12345');
  });

  test('a keystroke while focus is on the page, not a control, is moved into the field', async ({
    page,
  }) => {
    const barcode = await openPos(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.type(SCAN);
    await expect(barcode).toHaveValue(SCAN);
  });
});

test.describe('POS barcode focus trap with an open Dialog', () => {
  test('focus stays in the Dialog while it is open, and no scan leaks into the field behind it', async ({
    page,
  }) => {
    const barcode = await openPos(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign out of the point of sale?' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => focusIsInside(dialog)).toBe(true);

    // Typing a scan now must not reach the barcode field.
    await page.keyboard.type(SCAN);
    await expect(barcode).toHaveValue('');
    expect(await focusIsInside(dialog)).toBe(true);

    // Tab and Shift+Tab wrap inside the Dialog: the trap never lets focus out.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await focusIsInside(dialog), `after Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusIsInside(dialog), `after Shift+Tab ${i + 1}`).toBe(true);
    }
    // A click on the scrim does not drop focus onto the page either.
    await expect(barcode).not.toBeFocused();
  });

  test('Escape closes the Dialog and focus returns to the barcode field, not the button that opened it', async ({
    page,
  }) => {
    const barcode = await openPos(page);
    const opener = page.getByRole('button', { name: 'Sign out' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(barcode).toBeFocused();
    await expect(opener).not.toBeFocused();
    // And the next scan lands.
    await page.keyboard.type(SCAN);
    await expect(barcode).toHaveValue(SCAN);
  });

  test('the Stay signed in button and the close button both hand focus back to the barcode field', async ({
    page,
  }) => {
    const barcode = await openPos(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(barcode).toBeFocused();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(barcode).toBeFocused();
  });

  test('keyboard only: reach the button by Tab, open with Enter, close with Escape, scan on', async ({
    page,
  }) => {
    const barcode = await openPos(page);
    // Tab away from the field through the header controls to the sign-out button.
    await page.keyboard.press('Tab');
    const opener = page.getByRole('button', { name: 'Sign out' });
    for (let i = 0; i < 8 && !(await opener.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(opener).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(barcode).toBeFocused();
    await page.keyboard.type(SCAN);
    await expect(barcode).toHaveValue(SCAN);
  });

  test('confirming signs out and leaves the POS', async ({ page }) => {
    await openPos(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('POS shell chrome', () => {
  test('shows the connection state in icon and words, and explains offline in a persistent line', async ({
    page,
    context,
  }) => {
    await openPos(page);
    await expect(page.getByRole('status').filter({ hasText: 'Online' })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
    await expect(
      page.getByText('Sales are kept on this device and sent when the connection returns.'),
    ).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole('status').filter({ hasText: 'Online' })).toBeVisible();
    await expect(page.getByText('Sales are kept on this device')).toHaveCount(0);
  });

  test('has no sidebar, large touch targets, and no sideways scroll at 360 px', async ({
    page,
  }) => {
    await openPos(page);
    // No sidebar: the till's one navigation (F9) is a row across the top, as wide as the screen.
    await expect(page.getByRole('navigation')).toHaveCount(1);
    const nav = await page.getByRole('navigation', { name: 'Till' }).boundingBox();
    expect(nav?.width ?? 0).toBeGreaterThanOrEqual(355);
    expect(nav?.y ?? 0).toBeLessThan(200);
    const size = await page.getByRole('button', { name: 'Sign out' }).boundingBox();
    expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test.describe('on a device set to dark', () => {
    // The default context, so the fake API (ADR 0026) is installed on it as on every other test.
    test.use({ colorScheme: 'dark' });

    test('the POS shell defaults to the light theme even on a dark device', async ({ page }) => {
      await signIn(page, USERS.cashier, '/pos');
      await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    });
  });
});
