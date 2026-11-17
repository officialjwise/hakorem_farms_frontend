import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F5's primary flows (FR-INV). The gate is the first test: a storekeeper completes a stock take on a phone
 * (the suite runs at 360 px), standing in the cold room: a blind count by the keyboard, saved, finished,
 * reviewed against the API's differences. The owner then posts it (or sends it for approval): posting is
 * the Owner's and the Manager's in the seed (CR-023).
 */

const TAKE = '019a7aba-06c9-7349-b881-3d6a7794b648';
const COLD_ROOM = {
  id: '019a7a84-9e23-7d04-a1f0-7b5d0d2c3a11',
  code: 'COLD',
  name: 'Cold room',
  kind: 'COLD_ROOM',
};
const ANY = '019a7a86-3046-711a-a652-1a7389f79351';

test.describe('the F5 gate: a stock take completed on a phone in the cold room', () => {
  test('the storekeeper counts blind by the keyboard, saves, finishes and reads the differences; the owner posts', async ({
    page,
    api,
  }) => {
    // One stock take of the cold room, counting until the mock is asked to finish, then in review.
    const finished = () => api.log.some((e) => e.operationId === 'closeStockTakeCounting');
    api.rewrite('getStockTake', (body) => ({
      ...(body as object),
      location: COLD_ROOM,
      status: finished() ? 'REVIEW' : 'COUNTING',
      gainValuePesewas: finished() ? 4000 : null,
      lossValuePesewas: finished() ? 97100 : null,
    }));
    api.prefer('submitStockTake', 'code=202');
    // Since CR-012 (contract 1.20.0) the lines example is the take while counting, blind, so in review the
    // differences are served here: contract 1.17.0's own example values, by SKU. CR-020 asks for a named
    // in-review example, which would replace this table.
    const REVIEW: Record<string, [string, string, number, 'GAIN' | 'LOSS' | 'NONE']> = {
      'PRD-0005': ['40.000', '-6.000', 12000, 'LOSS'],
      'PRD-0002': ['26.000', '4.000', 3200, 'GAIN'],
      'EGG-0003': ['48.000', '-2.000', 8000, 'LOSS'],
      'MEAT-0005': ['29.750', '0.000', 0, 'NONE'],
      'MEAT-0001': ['97.800', '0.000', 0, 'NONE'],
      'PRD-0001': ['12.000', '-1.000', 51500, 'LOSS'],
    };
    api.rewrite('listStockTakeLines', (body) => {
      const page = body as { data: { product: { sku: string } }[] };
      if (!finished()) return page;
      return {
        ...page,
        data: page.data.map((line) => {
          const review = REVIEW[line.product.sku];
          if (review === undefined) return line;
          const [expectedQty, varianceQty, varianceValuePesewas, varianceDirection] = review;
          return { ...line, expectedQty, varianceQty, varianceValuePesewas, varianceDirection };
        }),
      };
    });

    await signIn(page, USERS.storekeeper, `/stock-takes/${TAKE}`);
    await expect(page.getByRole('heading', { name: /^Cold room/, level: 1 })).toBeVisible();
    await expect(page.getByText('Counting', { exact: true })).toBeVisible();
    const form = page.getByRole('form', { name: 'Counts for this page' });
    await expect(form).toBeVisible();
    await expect(form.getByText(/expected/i)).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    // Thumb on the first field, then type and Tab down the list.
    const inputs = form.getByRole('textbox');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(3);
    await inputs.first().focus();
    const counts = ['34', '30', '46', '29.750', '97.800', '11'];
    for (let i = 0; i < Math.min(count, counts.length); i += 1) {
      await page.keyboard.type(counts[i] ?? '0');
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: '6 counts saved' })).toBeVisible();
    const sent = api.log.filter((e) => e.operationId === 'recordStockTakeCounts');
    expect(sent.map((e) => e.outcome)).toEqual(['prism']);

    await page.getByRole('button', { name: 'Finish counting' }).click();
    const finish = page.getByRole('dialog', { name: 'Finish counting?' });
    await expect(finish).toContainText('of 24 lines are counted');
    await expectNoAxeViolations(page);
    await finish.getByRole('button', { name: 'Finish counting' }).click();

    await expect(page.getByText('In review', { exact: true })).toBeVisible();
    const differences = page.getByRole('region', { name: 'Counted against expected' });
    await expect(differences.getByRole('row').filter({ hasText: 'Yam, tuber' })).toContainText(
      'Loss',
    );
    await expect(page.getByText('GH₵971.00').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    // Posting is the Owner's and the Manager's (the seed, CR-023): the Storekeeper is told so, in words.
    await expect(page.getByRole('button', { name: 'Post the stock take' })).toHaveCount(0);
    await expect(page.getByText('The owner or a manager posts this stock take.')).toBeVisible();
    await page.getByRole('button', { name: /^Your account: / }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await signInWithTotp(page, USERS.owner, `/stock-takes/${TAKE}`);
    await expect(page.getByText('In review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Post the stock take' }).click();
    const post = page.getByRole('dialog', { name: 'Post the stock take?' });
    await expect(post).toContainText('Gain at cost: GH₵40.00');
    await expect(post).toContainText('Loss at cost: -GH₵971.00');
    await post.getByRole('button', { name: 'Post the stock take' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent for approval' })).toContainText(
      'Nothing has posted yet',
    );
    expect(api.log.filter((e) => e.operationId === 'submitStockTake')).toHaveLength(1);
  });
});

test.describe('stock documents', () => {
  test('stock on hand shows cost and selling price apart, and the API’s total at cost', async ({
    page,
  }) => {
    await signIn(page, USERS.storekeeper, '/stock');
    await expect(page.getByRole('heading', { name: 'Stock on hand', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Stock value at cost, every line shown by this filter'),
    ).toBeVisible();
    await expect(page.getByText('GH₵138,162.10')).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test('a storekeeper writes off expired stock: a draft, then the exact lines, then posted', async ({
    page,
    api,
  }) => {
    api.rewrite('getStockAdjustment', (body) => ({
      ...(body as object),
      status: 'DRAFT',
      adjustmentNo: null,
    }));
    // The write-off reason this test means. The contract's example dropped it in 1.43.0 (CR-030
    // rewrote the list around the billing reasons), so the test names it rather than lean on the example.
    api.rewrite('listReasonCodes', (body) => {
      const list = body as { data: Record<string, unknown>[] };
      return {
        ...list,
        data: [
          ...list.data,
          {
            code: 'EXPIRED',
            domain: 'WASTAGE',
            description: 'Past expiry date',
            requiresNote: false,
            lossAccountGroup: 'WASTAGE',
          },
        ],
      };
    });
    await signIn(page, USERS.storekeeper, '/stock-adjustments/new');
    await expect(page.getByRole('heading', { name: 'New adjustment', level: 1 })).toBeVisible();
    const pick = async (label: RegExp, option: string) => {
      const select = page.getByRole('combobox', { name: label });
      await select.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('option', { name: option }).press('Enter');
      await expect(select).toHaveText(option);
    };
    await pick(/^location/i, 'Goat pen 1');
    await pick(/^reason/i, 'Past expiry date');
    // Into the field first, as a person does: the reason list hands focus back to its own button as it
    // closes, and typing before that lands would close the product list again.
    const product = page.getByRole('combobox', { name: /^product 1/i });
    await product.click();
    await expect(product).toBeFocused();
    await product.fill('Goat');
    await page
      .getByRole('option', { name: /^Goat \(LIV-0004\)/ })
      .first()
      .click();
    await page.getByLabel(/^quantity/i).fill('3');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Save the draft' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Draft at');
    await page.getByRole('button', { name: 'Post the adjustment' }).click();
    const confirm = page.getByRole('dialog', { name: 'Post this adjustment?' });
    await expect(confirm).toContainText('Loss: Yam, tuber');
    await confirm.getByRole('button', { name: 'Post the adjustment' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'The adjustment is posted.' }),
    ).toBeVisible();
    expect(
      api.log.some((e) => e.operationId === 'createStockAdjustment' && e.outcome === 'prism'),
    ).toBe(true);
  });

  test('a transfer arrives short: what arrived is counted, the shortfall needs a reason, and the API gets both', async ({
    page,
    api,
  }) => {
    // The contract's example is already received; here it is on the way, its line not yet answered.
    api.rewrite('getStockTransfer', (body) => {
      const transfer = body as { lines: Record<string, unknown>[] };
      return {
        ...transfer,
        status: 'DISPATCHED',
        receivedAt: null,
        receivedBy: null,
        lines: transfer.lines.map((l) => ({
          ...l,
          qtyReceived: null,
          varianceQty: null,
          varianceReasonCode: null,
        })),
      };
    });
    const sent: unknown[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/receive')) {
        sent.push(request.postDataJSON());
      }
    });
    await signIn(page, USERS.storekeeper, `/stock-transfers/${ANY}`);
    await expect(page.getByText('On the way', { exact: true })).toBeVisible();
    const form = page.getByRole('form', { name: 'What arrived, line by line' });
    const arrived = form.getByLabel(/^Goat meat, 15 kg pack: quantity that arrived/);
    await expect(arrived).toHaveValue('');
    await arrived.fill('29.750');
    await expect(form.getByText('Short', { exact: true })).toBeVisible();
    await form.getByRole('button', { name: 'Check and receive' }).click();
    await expect(form.getByText('Choose a reason for the shortfall.')).toBeVisible();
    const reason = form.getByRole('combobox', { name: /^Why Goat meat, 15 kg pack is short/ });
    await reason.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'Earlier count was wrong' }).press('Enter');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await form.getByRole('button', { name: 'Check and receive' }).click();
    const confirm = page.getByRole('dialog', { name: 'Receive this transfer?' });
    await expect(confirm).toContainText('1 line is short');
    await confirm.getByRole('button', { name: 'Receive' }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 line was short' })).toBeVisible();
    expect(sent).toEqual([
      {
        lines: [
          {
            lineId: '019a7ab6-85b6-7485-a9bd-5121ae87c9ff',
            // Counted in the unit the line was sent in (2.2.0); the server converts to the base unit.
            uom: 'KG',
            qtyReceived: '29.750',
            varianceReasonCode: 'COUNT_ERROR',
          },
        ],
      },
    ]);
  });

  test('a goods receipt is posted only after its lines and total at cost are shown', async ({
    page,
    api,
  }) => {
    api.rewrite('getGoodsReceipt', (body) => ({ ...(body as object), status: 'DRAFT' }));
    await signIn(page, USERS.storekeeper, `/goods-receipts/${ANY}`);
    await page.getByRole('button', { name: 'Post the receipt' }).click();
    const confirm = page.getByRole('dialog', { name: 'Post this receipt?' });
    await expect(confirm).toContainText('Total at cost');
    await confirm.getByRole('button', { name: 'Post the receipt' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'The receipt is posted.' }),
    ).toBeVisible();
  });
});

const F5_ROUTES = [
  '/stock',
  '/stock-takes',
  `/stock-takes/${TAKE}`,
  '/stock-adjustments',
  `/stock-adjustments/${ANY}`,
  '/stock-adjustments/new',
  '/stock-transfers',
  `/stock-transfers/${ANY}`,
  '/stock-transfers/new',
  '/goods-receipts',
  `/goods-receipts/${ANY}`,
  '/goods-receipts/new',
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`every F5 screen is axe clean at 360 px (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of F5_ROUTES) {
      test(path, async ({ page }) => {
        await signInWithTotp(page, USERS.owner, path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

test.describe('a wrong role meets words', () => {
  for (const [path, permission] of [
    ['/stock-takes', 'inv.stock_take.read'],
    ['/stock-adjustments/new', 'inv.adjustment.create'],
    ['/goods-receipts', 'inv.goods_receipt.read'],
  ] as const) {
    test(`a cashier opening ${path} is denied in words, naming ${permission}`, async ({
      page,
      api,
    }) => {
      await signIn(page, USERS.cashier, path);
      await expect(
        page.getByRole('alert').filter({ hasText: 'You do not have access to this page' }),
      ).toBeVisible();
      await expect(page.getByText(permission)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
      expect(api.log.filter((e) => e.outcome === 'prism-403')).toEqual([]);
    });
  }
});
