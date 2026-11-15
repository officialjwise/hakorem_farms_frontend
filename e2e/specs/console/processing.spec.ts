import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F6's processing flows (FR-PRC), at 360 px: an order started (no stock moves), completed after a
 * confirmation that shows what is consumed and what it cost, cancelled with a reason; and the trace the brief
 * asks for, from a meat lot back to its animal.
 */

const ANY = '019a7a86-3046-711a-a652-1a7389f79351';

/** The example order, at an earlier point in its life: what the API answers before completion (1.22.0). */
function atStatus(status: 'PLANNED' | 'IN_PROGRESS') {
  return (body: unknown) => {
    const order = body as {
      outputs: {
        stockUnit: unknown;
        allocatedCostPesewas: unknown;
        referencePricePesewasPerKg: unknown;
      }[];
    };
    return {
      ...order,
      status,
      completedAt: null,
      postedAt: null,
      postedBy: null,
      inputCostPesewas: null,
      totalCostPesewas: null,
      actualYieldPercent: null,
      yieldVarianceFlag: false,
      outputs:
        status === 'PLANNED'
          ? []
          : order.outputs.map((output) => ({
              ...output,
              stockUnit: null,
              allocatedCostPesewas: null,
            })),
    };
  };
}

test('a planned order is started, and starting moves no stock', async ({ page, api }) => {
  api.rewrite('getProcessingOrder', atStatus('PLANNED'));
  await signInWithTotp(page, USERS.owner, `/processing-orders/${ANY}`);
  await page.getByRole('button', { name: 'Start processing' }).click();
  const confirm = page.getByRole('dialog', { name: 'Start processing?' });
  await expect(confirm).toContainText('Starting moves no stock');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Start processing' }).click();
  await expect(page.getByText(/^Started\. Nothing has moved yet/)).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'startProcessingOrder')).toHaveLength(1);
});

test('an order in progress is completed after a confirmation of what is consumed and what it cost', async ({
  page,
  api,
}) => {
  api.rewrite('getProcessingOrder', atStatus('IN_PROGRESS'));
  await signInWithTotp(page, USERS.owner, `/processing-orders/${ANY}`);
  await expect(page.getByText('Set at completion').first()).toBeVisible();
  await page.getByRole('button', { name: 'Complete the order' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete the order?' });
  await expect(confirm).toContainText('G-0098');
  await expect(confirm).toContainText('A completed order cannot be changed or cancelled.');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await confirm.getByRole('button', { name: 'Complete the order' }).click();
  await expect(page.getByText(/^Completed\. The animals are consumed/)).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'completeProcessingOrder')).toHaveLength(1);
});

test('an order in progress can still be cancelled, with a reason, and nothing moves', async ({
  page,
  api,
}) => {
  api.rewrite('getProcessingOrder', atStatus('IN_PROGRESS'));
  await signInWithTotp(page, USERS.owner, `/processing-orders/${ANY}`);
  await page.getByRole('button', { name: 'Cancel the order' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this processing order?' });
  await dialog.getByRole('textbox').fill('Animal found lame at the processing room door');
  await dialog.getByRole('button', { name: 'Cancel the order' }).click();
  await expect(page.getByText(/^Cancelled\. Nothing had moved/)).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'cancelProcessingOrder')).toHaveLength(1);
});

test('a meat lot traces back to its animal: lot, order, animal', async ({ page }) => {
  await signInWithTotp(page, USERS.owner, `/processing-orders/${ANY}`);
  // From the order's output to its lot, and from the order's input to the animal it was cut from.
  await expect(page.getByRole('link', { name: 'PRC-261109-3a247e03-01' })).toHaveAttribute(
    'href',
    '/lots?q=PRC-261109-3a247e03-01',
  );
  await page.getByRole('link', { name: 'G-0098' }).click();
  await expect(page).toHaveURL(/\/animals\/019a7a90-37c3-75d9-9b12-666ffe5adf4d$/);
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
});

for (const [path, ready] of [
  ['/processing-orders', 'G-0104'],
  [`/processing-orders/${ANY}`, 'PRC-261109-3a247e03-01'],
  ['/processing-orders/new', 'Planning an order moves no stock'],
  ['/yield-standards', 'Broiler chicken'],
] as const) {
  test(`${path} at 360 px: axe clean, no sideways scroll`, async ({ page }) => {
    await signInWithTotp(page, USERS.owner, path);
    await expect(page.getByText(ready).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
