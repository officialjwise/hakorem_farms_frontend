import { formatMoney } from '../../../packages/ui/src/format/format';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { EGGS_ID, eggsByTheEgg } from '../../support/eggs';
import { expect, test } from '../../support/test';
import { installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * The egg session, part b: a crate and a single egg as two units of one product at the till (ADR 0049),
 * built against CR-038 behind its switch (ADR 0046), at 360 px with the network off. Each unit is priced
 * from the pack's own band for it: a crate at GH₵60.00, a single egg at GH₵2.20, never the crate price
 * divided by 30. The sale line names its unit; the server converts to eggs and re-prices at sync.
 */

const CRATE = 6000;
const EGG = 220;
const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);

test('a crate and six single eggs are sold offline, each at its own price, and sync with their units', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal, { products: eggsByTheEgg });
  await openTillShift(page);
  await api.setNetwork(context, false);

  // The cashier taps the eggs and says which: by the crate.
  await page.getByRole('button', { name: 'Eggs, big', exact: true }).click();
  const choose = page.getByRole('dialog', { name: 'Sell Eggs, big by which unit?' });
  await expect(choose.getByRole('button', { name: /^By the crate/ })).toContainText(
    formatMoney(CRATE),
  );
  await expect(choose.getByRole('button', { name: /^By the egg/ })).toContainText(formatMoney(EGG));
  await expectNoAxeViolations(page);
  await choose.getByRole('button', { name: /^By the crate/ }).click();

  // Then single eggs: six of them, at the egg's own price.
  await page.getByRole('button', { name: 'Eggs, big', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Sell Eggs, big by which unit?' })
    .getByRole('button', { name: /^By the egg/ })
    .click();
  const cart = page.getByRole('region', { name: 'This sale' });
  await cart
    .getByRole('button', { name: /^Change Eggs, big/ })
    .last()
    .click();
  const line = page.getByRole('dialog', { name: 'Change Eggs, big' });
  await line.getByRole('textbox', { name: /^Quantity/ }).fill('6');
  await expect(line).toContainText(`This item comes to ${formatMoney(6 * EGG)}`);
  await line.getByRole('button', { name: 'Save the item' }).click();
  await expect(cart.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(CRATE + 6 * EGG));
  await expect(cart).toContainText('1 crate');
  // The offline pack names no unit, so the till says the code: "6 egg" until CR-051 gives it the names.
  await expect(cart).toContainText('6 egg');
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);

  await cart.getByRole('button', { name: 'Take payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('80');
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete this sale?' });
  await expect(confirm).toContainText(formatMoney(CRATE));
  await expect(confirm).toContainText(formatMoney(6 * EGG));
  await confirm.getByRole('button', { name: 'Complete the sale' }).click();
  await expect(page.getByRole('heading', { name: 'Sale complete' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await api.setNetwork(context, true);
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('All sent');
  const sale = server.batches[0]?.sales[0] as SentSale;
  // Each line names the unit it was sold in, at that unit's price; nothing was converted on the till.
  expect(sale.lines).toEqual([
    { productId: EGGS_ID, quantity: '1.000', agreedUnitPricePesewas: CRATE, uom: 'CRATE' },
    { productId: EGGS_ID, quantity: '6.000', agreedUnitPricePesewas: EGG, uom: 'EGG' },
  ]);
});
