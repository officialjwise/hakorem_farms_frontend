import { REVIEW_EXCEPTION } from '../../../apps/console/src/requested/exceptionReview';
import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/** The contract example's URGENT stock conflict: goat G-0171 sold at two tills. */
const STOCK_CONFLICT = '019a7b12-f5e9-7141-b679-1ce8547495c6';
const OWNER = { id: '019a7a86-1c4e-7b9a-9e2f-5d3c8a1b7e04', displayName: 'Ama Mensah' };

type Body = Record<string, unknown>;

/**
 * F12's gate, the part that is what went wrong: the owner opens today's exception report without asking
 * anyone, reads the urgent items first with who, when, how much and the record behind each, and marks one
 * reviewed with a note (CR-058, answered here in the requested shape).
 */
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the daily exception report, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('the owner reads what went wrong today, urgent first, and marks one reviewed', async ({
      page,
      api,
    }) => {
      const reviews = new Map<string, Body>();
      api.respondRequested(REVIEW_EXCEPTION, (request, path) => {
        const id = path.split('/')[2] ?? '';
        const review = {
          reviewedBy: OWNER,
          reviewedAt: '2026-11-19T17:05:00Z',
          note: (request as { note: string }).note,
        };
        reviews.set(id, review);
        return { id, review };
      });
      api.rewrite('getDailyExceptionReport', (body) => {
        const report = body as Body & { items: Body[] };
        return {
          ...report,
          items: report.items.map((item) => ({
            ...item,
            review: reviews.get(String(item.id)) ?? null,
          })),
        };
      });
      await signInWithTotp(page, USERS.owner, '/');
      await page.getByRole('button', { name: /^Notifications/ }).click();
      await page.getByRole('link', { name: 'Open the daily exception report' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Daily exception report' }),
      ).toBeVisible();
      const list = page.getByRole('list', { name: 'Exceptions, urgent first' });
      const cards = list.getByRole('listitem');
      await expect(cards.first()).toContainText('Urgent');
      await expect(cards.first()).toContainText('Not reviewed');
      await expect(cards.last()).toContainText('For information');
      const conflict = cards.filter({ hasText: 'Goat G-0171 sold offline at till T2' });
      await expect(conflict).toContainText('Nana Yeboah');
      await expect(conflict).toContainText('GH₵589.00');
      await expect(conflict).toContainText('stock conflict');
      const voided = cards.filter({ hasText: 'Sale voided' });
      await expect(voided.getByRole('link', { name: 'Open the sale' })).toHaveAttribute(
        'href',
        '/orders/019a7b12-5b3e-7fd0-a508-05d2f3ff7eb0',
      );
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);

      await conflict.getByRole('button', { name: /^Mark reviewed/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Mark this exception reviewed' });
      await dialog.getByRole('button', { name: 'Mark reviewed' }).click();
      await expect(dialog.getByText('Required').first()).toBeVisible();
      await dialog
        .getByLabel(/What you found or did/)
        .fill('Called Nana: T2 was offline. The second sale is reversed.');
      await expectNoAxeViolations(page);
      await dialog.getByRole('button', { name: 'Mark reviewed' }).click();
      await expect(dialog).toBeHidden();
      const reviewed = cards.filter({ hasText: 'Goat G-0171 sold offline at till T2' });
      await expect(reviewed).toContainText('Reviewed by Ama Mensah');
      await expect(reviewed).toContainText('Called Nana: T2 was offline.');
      // Still urgent, so still before every REVIEW item, but after the urgent item nobody has reviewed.
      await expect(cards.nth(1)).toContainText('Goat G-0171 sold offline at till T2');
      const sent = api.log.filter((entry) => entry.operationId === 'reviewException');
      expect(sent.map((entry) => entry.path)).toEqual([`/exceptions/${STOCK_CONFLICT}/review`]);
      expect(sent[0]?.outcome).toBe('requested');
    });
  });
}

test('a day with nothing raised says so in words', async ({ page, api }) => {
  api.rewrite('getDailyExceptionReport', (body) => ({
    ...(body as Body),
    counts: [],
    items: [],
  }));
  await signInWithTotp(page, USERS.owner, '/exceptions');
  await expect(page.getByText('Nothing went wrong on this day')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('a cashier sees the permission-denied state, not a broken page', async ({ page }) => {
  await signIn(page, USERS.cashier);
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.goto('/exceptions');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('You do not have access to this page');
  await expect(alert).toContainText('rpt.exceptions.read');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});
