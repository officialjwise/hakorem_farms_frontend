import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { expect, test } from '../../support/test';
import { installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * A business buyer's name and TIN on a counter sale's receipt at 360 px (2.26.0, `OfflineSale.buyer`): both or
 * neither, the TIN of a Ghanaian form, sent with the sale under its hash, and printed on the receipt. It
 * makes no customer.
 */

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);

test("a business buyer's name and TIN go with the sale and onto its receipt", async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('650');
  const buyer = pay.getByRole('group', { name: 'A business buyer on the receipt' });
  await buyer.getByRole('textbox', { name: /^Business name/ }).fill('Akosua Bakery');
  await expect(pay).toContainText('Enter the business’s TIN too, or clear the name.');
  await expect(pay.getByRole('button', { name: 'Review the sale' })).toBeDisabled();
  await buyer.getByRole('textbox', { name: /^Its TIN/ }).fill('X123');
  await expect(pay).toContainText('This is not a GRA TIN or a Ghana Card PIN.');
  await buyer.getByRole('textbox', { name: /^Its TIN/ }).fill('c0000000042');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await pay.getByRole('button', { name: 'Review the sale' }).click();

  const confirm = page.getByRole('dialog', { name: 'Complete this sale?' });
  await expect(confirm).toContainText(
    'On the receipt as the buyer: Akosua Bakery, TIN C0000000042.',
  );
  await confirm.getByRole('button', { name: 'Complete the sale' }).click();
  await expect(page.locator('[data-slot="receipt-buyer"]')).toHaveText(
    'Buyer: Akosua Bakery, TIN C0000000042',
  );
  await expect.poll(() => server.batches.flatMap((batch) => batch.sales).length).toBeGreaterThan(0);
  const sent = server.batches.flatMap((batch) => batch.sales);
  expect(sent.every((sale) => sale.buyer?.name === 'Akosua Bakery')).toBe(true);
  expect(sent.every((sale) => sale.buyer?.tin === 'C0000000042')).toBe(true);
  await expectNoAxeViolations(page);
});
