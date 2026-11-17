import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import {
  eggOrder,
  eggReceipt,
  EGGS_ID,
  ORDER_ID,
  ORDER_LINE_ID,
  seedEggs,
  STORE,
  SUPPLIER,
} from '../../support/eggs';
import type { components } from '@hakorem/api-client';

/**
 * The egg session, part a: buying (ADR 0049; contract 2.2.0 and 2.3.0). The storekeeper orders crates of
 * eggs from a supplier at the last price paid, the delivery comes in against the order in crates, and
 * cracked crates are turned away at the door with a reason. The suite runs at 360 px, the shop's phone.
 * Every price, total and egg count shown is the API's: the browser sends crates and never converts.
 */

type S = components['schemas'];

test.describe('buying eggs by the crate', () => {
  test('a purchase order is drafted in crates at the last price paid, then submitted', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    const submitted = () => api.log.some((e) => e.operationId === 'submitPurchaseOrder');
    api.rewrite('createPurchaseOrder', (body) => eggOrder(body as S['PurchaseOrder'], 'DRAFT'));
    api.rewrite('getPurchaseOrder', (body) =>
      eggOrder(body as S['PurchaseOrder'], submitted() ? 'APPROVED' : 'DRAFT'),
    );

    await signIn(page, USERS.storekeeper, '/purchase-orders/new');
    await expect(page.getByRole('heading', { name: 'New purchase order' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Supplier/ }).click();
    await page.getByRole('option', { name: `${SUPPLIER.name} (${SUPPLIER.publicId})` }).click();
    await page.getByRole('combobox', { name: /^Deliver to/ }).click();
    // The contract's location list; the order's answer names the store it was delivered to.
    await page.getByRole('option', { name: 'Dodowa farm' }).click();

    await page.getByRole('combobox', { name: /^Product 1/ }).fill('Eggs');
    await page.getByRole('option', { name: 'Eggs, big (EGG-0003)' }).click();
    // The crate is the product's own conversion, as the API holds it: 30 eggs.
    await page.getByRole('combobox', { name: 'Counted in, line 1' }).click();
    await page.getByRole('option', { name: 'Crate (30 Unit)' }).click();
    await page.getByLabel(/^Ordered, in Crate, line 1/).fill('20');
    // No price: the server takes the last price paid to this supplier for a crate (2.3.0).
    await expect(page.getByLabel('Price per Crate, GHS, line 1')).toHaveValue('');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/mock/purchase-orders',
    );
    await page.getByRole('button', { name: 'Save the draft' }).click();
    const body = (await sent).postDataJSON() as S['PurchaseOrderCreate'];
    expect(body).toMatchObject({
      supplierId: SUPPLIER.id,
      deliverToLocationId: '019a7a83-68cd-7daa-b2e2-e3779b105c55',
    });
    expect(body.lines).toEqual([{ productId: EGGS_ID, uom: 'CRATE', qtyOrdered: '20.000' }]);

    // The draft shows what the server priced: 20 crates, 600 eggs, GHS 47.50 a crate, GHS 950.00.
    await expect(page.getByRole('heading', { name: 'PO-2026-DDW-000052' })).toBeVisible();
    const lines = page.getByRole('region', { name: 'Ordered lines' });
    await expect(lines).toContainText('Eggs, big');
    await expect(lines).toContainText('600');
    await expect(lines).toContainText('per Crate');
    await expect(lines).toContainText('47.50');
    await expect(page.getByText('950.00').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Submit the order' }).click();
    const confirm = page.getByRole('dialog', { name: 'Submit this purchase order?' });
    await expect(confirm).toContainText('To Awutu Poultry Farm');
    await expect(confirm).toContainText('950.00');
    await confirm.getByRole('button', { name: 'Submit the order' }).click();
    await expect(page.getByText('Approved. It can be sent to the supplier.')).toBeVisible();
  });

  test('a delivery is received against the order in crates, with cracked crates rejected for a reason', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    api.rewrite('getPurchaseOrder', (body) => eggOrder(body as S['PurchaseOrder'], 'SENT'));
    // The receipt as the server answers it: 18 crates in (540 eggs), 2 crates turned away, cracked.
    api.rewrite('getGoodsReceipt', (body) => eggReceipt(body as S['GoodsReceipt']));

    await signIn(page, USERS.storekeeper, `/purchase-orders/${ORDER_ID}`);
    await page.getByRole('link', { name: 'Receive a delivery' }).click();
    await expect(page.getByRole('heading', { name: 'New goods receipt' })).toBeVisible();
    // The order fills the supplier, the place and the line: its product and unit are the order's.
    await expect(page.getByText('Eggs, big, ordered in Crate')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Supplier/ })).toContainText(SUPPLIER.name);
    await expect(page.getByRole('combobox', { name: /^Purchase order/ })).toContainText(
      'PO-2026-DDW-000052',
    );
    await expect(page.getByRole('combobox', { name: /^Received at/ })).toContainText(STORE.name);
    await page.getByLabel(/^Accepted, in Crate, line 1/).fill('18');
    await page.getByLabel(/^Rejected at the door, in Crate, line 1/).fill('2');
    await page.getByLabel(/^Cost of the accepted quantity, GHS, line 1/).fill('855.00');

    // A rejection without its reason is not sent: the server would refuse it (REJECTION_REASON_REQUIRED).
    await page.getByRole('button', { name: 'Save the draft' }).click();
    const reason = page.getByRole('combobox', { name: /^Why it was rejected, line 1/ });
    await expect(reason).toHaveAccessibleDescription(/Required/);
    await reason.click();
    await page.getByRole('option', { name: 'Cracked on arrival' }).click();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/mock/goods-receipts',
    );
    await page.getByRole('button', { name: 'Save the draft' }).click();
    const body = (await sent).postDataJSON() as S['GoodsReceiptCreate'];
    expect(body).toMatchObject({
      kind: 'PURCHASE',
      supplierId: SUPPLIER.id,
      purchaseOrderId: ORDER_ID,
      locationId: STORE.id,
    });
    // Crates go as crates; the server converts to eggs and books 540 (2.2.0).
    expect(body.lines).toEqual([
      {
        productId: EGGS_ID,
        purchaseOrderLineId: ORDER_LINE_ID,
        uom: 'CRATE',
        qtyReceived: '18.000',
        qtyRejected: '2.000',
        rejectionReasonCode: 'CRACKED',
        valuePesewas: 85500,
      },
    ]);

    await page.waitForURL(/\/goods-receipts\/[0-9a-f-]{36}$/);
    await expect(page.getByText('1 line was turned away at the door')).toBeVisible();
    const table = page.getByRole('region', { name: 'Lines' });
    await expect(table).toContainText('Cracked on arrival');
    await expect(table).toContainText('540');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Post the receipt' }).click();
    const confirm = page.getByRole('dialog', { name: 'Post this receipt?' });
    await expect(confirm).toContainText('Rejected, Cracked on arrival:');
    await expect(confirm).toContainText('855.00');
  });

  test('a claim for the cracked crates is raised from the posted receipt; the server values it', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    const raised = () => api.log.some((e) => e.operationId === 'raiseSupplierClaim');
    api.rewrite('getGoodsReceipt', (body) => ({
      ...eggReceipt(body as S['GoodsReceipt']),
      status: 'POSTED',
      receiptNo: 'GRN-2026-DDW-000081',
    }));
    // No claim until one is raised; then the receipt answers it (2.4.0, `listGoodsReceiptClaims`).
    api.rewrite('listGoodsReceiptClaims', (body) =>
      raised() ? body : { ...(body as object), data: [] },
    );

    await signInWithTotp(page, USERS.owner, `/goods-receipts/${ORDER_ID}`);
    await expect(page.getByRole('heading', { name: 'Claim with the supplier' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Raise a claim' }).click();
    const confirm = page.getByRole('dialog', { name: `Raise a claim with ${SUPPLIER.name}?` });
    await expect(confirm).toContainText('Cracked on arrival');
    await confirm
      .getByLabel(/^Note for the supplier/)
      .fill('Two crates cracked, signed by the driver');
    await expectNoAxeViolations(page);
    const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/claims'));
    await confirm.getByRole('button', { name: 'Raise a claim' }).click();
    // Only a note goes: the value is the server's, from the order's price (an amount is refused).
    expect((await sent).postDataJSON()).toEqual({
      note: 'Two crates cracked, signed by the driver',
    });
    const done = page
      .getByRole('status')
      .filter({ hasText: `A claim is raised with ${SUPPLIER.name}.` });
    await expect(done).toContainText('GH₵11.09');
    // The receipt then reads its claim back: open on the supplier's account, line by line.
    await expect(page.getByText("Open: on Awutu Poultry Farm's account")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise a claim' })).toHaveCount(0);
  });

  test('the storekeeper reads the purchase orders', async ({ page }) => {
    await signIn(page, USERS.storekeeper, '/purchase-orders');
    await expect(page.getByRole('heading', { name: 'Purchase orders' })).toBeVisible();
    await expect(page.getByText('PO-2026-DDW-000040')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a cashier is told they cannot see purchase orders', async ({ page }) => {
    await signIn(page, USERS.cashier, '/purchase-orders');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('You do not have access to this page');
    await expect(alert).toContainText('pur.purchase_order.read');
    await expect(page.getByText('PO-2026-DDW-000040')).toHaveCount(0);
  });
});
