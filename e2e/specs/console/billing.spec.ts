import { formatMoney } from '../../../packages/ui/src/format/format';
import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F8's billing flows (FR-BIL), at 360 px. The gate: a reprint is visibly a reprint, and the tax breakdown
 * matches the API to the pesewa. Then a credit note sent for approval, a debit note issued, statements,
 * a wrong role, and axe on every route.
 */

const RECEIPT = '019a7ae2-fd46-7b80-a0b9-c0e09cf739be';
const NAME = 'Receipt RCP-2026-DDW-T1-018834';
/** A one-page PDF, as `ReprintResult.pdfBase64` carries the archived file with its marker. */
const PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDEwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==';

interface Levy {
  levyCode: string;
  levyName: string;
  amountPesewas: number;
}
interface Doc {
  netPesewas: number;
  taxPesewas: number;
  grossPesewas: number;
  levyTotals: Levy[];
}

test.describe('the F8 gate', () => {
  test('the tax breakdown matches the API to the pesewa, and nothing is added up on screen', async ({
    page,
    api,
  }) => {
    // Odd figures on purpose: a levy total of 1 pesewa, and a tax total the screen could never get by
    // adding the levies up (5,738 + 956 + 1 is 6,695, not 7,651). The screen must show the API's.
    let sent: Doc | null = null;
    api.rewrite('getBillingDocument', (body) => {
      const doc = body as Doc;
      const levyTotals = doc.levyTotals.map((levy) =>
        levy.levyCode === 'GETFUND' ? { ...levy, amountPesewas: 1 } : levy,
      );
      sent = { ...doc, levyTotals, taxPesewas: 7651, grossPesewas: 137901 };
      return { ...(body as object), ...sent };
    });
    await signInWithTotp(page, USERS.owner, `/billing-documents/${RECEIPT}`);
    await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
    const breakdown = page.getByRole('region', { name: 'Tax breakdown' });
    expect(sent).not.toBeNull();
    const doc = sent as unknown as Doc;
    const rows: [string, number][] = [
      ...doc.levyTotals.map((levy): [string, number] => [
        `${levy.levyName} (${levy.levyCode})`,
        levy.amountPesewas,
      ]),
      ['Net', doc.netPesewas],
      ['Tax and levies', doc.taxPesewas],
      ['Total', doc.grossPesewas],
    ];
    for (const [term, pesewas] of rows) {
      const value = breakdown
        .locator('dt', { hasText: term })
        .locator('xpath=following-sibling::dd[1]');
      await expect(value).toHaveText(formatMoney(pesewas));
    }
    await expect(breakdown).toContainText('GH₵0.01');
    await expect(breakdown).toContainText('GH₵76.51');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test('a reprint is visibly a reprint: marked with its copy number, the same document, the same number', async ({
    page,
    api,
  }) => {
    api.rewrite('reprintBillingDocument', () => ({
      copyNo: 2,
      channel: 'PDF',
      url: null,
      escPosBase64: null,
      pdfBase64: PDF_BASE64,
      expiresAt: null,
    }));
    await signInWithTotp(page, USERS.owner, `/billing-documents/${RECEIPT}`);
    await page.getByRole('button', { name: 'Reprint as PDF' }).click();
    const confirm = page.getByRole('dialog', { name: 'Reprint this document?' });
    await expect(confirm).toContainText('It is not a new document and gets no new number.');
    await expect(confirm).toContainText('The copy is numbered and logged with your name');
    await expectNoAxeViolations(page);
    const sentBody = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith(`/${RECEIPT}/reprint`),
    );
    await confirm.getByRole('button', { name: 'Reprint as PDF' }).click();
    expect((await sentBody).postDataJSON()).toEqual({ channel: 'PDF' });

    const marker = page.getByRole('region', { name: 'Reprint 2: a copy, not a new document' });
    await expect(marker).toBeVisible();
    await expect(marker).toContainText(`This is copy 2 of ${NAME}`);
    await expect(marker).toContainText('The document itself has not changed and keeps its number.');
    await expect(marker.locator('iframe')).toHaveAttribute('title', `Reprint 2 of ${NAME}`);
    await expect(marker.getByRole('link', { name: 'Save reprint 2 (PDF)' })).toHaveAttribute(
      'download',
      'RCP-2026-DDW-T1-018834-reprint-2.pdf',
    );
    // The marker leads the page, above everything but the title: it cannot be scrolled past unseen.
    const markerTop = (await marker.boundingBox())?.y ?? Infinity;
    const linesTop =
      (await page.getByRole('region', { name: 'Lines', exact: true }).boundingBox())?.y ?? 0;
    expect(markerTop).toBeLessThan(linesTop);
    // Still the same document under the same number.
    await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
    expect(api.log.filter((e) => e.operationId === 'reprintBillingDocument')).toHaveLength(1);
    await expectNoHorizontalScroll(page);
  });
});

test('a credit note is sent for a second person, and the page says nothing has been posted', async ({
  page,
  api,
}) => {
  api.prefer('issueCreditNote', 'code=202');
  await signInWithTotp(page, USERS.owner, `/billing-documents/${RECEIPT}`);
  await page.getByRole('link', { name: 'Raise a credit note' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Credit note against ${NAME}` }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: /^Reason/ }).click();
  await page.getByRole('option', { name: 'Damaged in delivery' }).click();
  await page
    .getByRole('textbox', { name: /^Note/ })
    .fill('Two crates broken, photographed by the driver');
  await page.getByRole('combobox', { name: 'Credit line 2 by' }).click();
  await page.getByRole('option', { name: 'Quantity' }).click();
  await page.getByRole('textbox', { name: /^Quantity to credit on line 2/ }).fill('2');
  await page.getByRole('button', { name: 'Review the credit note' }).click();
  const confirm = page.getByRole('dialog', { name: 'Send this credit note for approval?' });
  await expect(confirm).toContainText('Line 2, Eggs, big, crate of 30:');
  await expect(confirm).toContainText('worked out by the API');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await confirm.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByText('The credit note waits for approval')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the request' })).toHaveAttribute(
    'href',
    '/approvals/019a7ae6-218c-7c9b-81d3-d282f8f14b60',
  );
  expect(api.log.filter((e) => e.operationId === 'issueCreditNote')).toHaveLength(1);
});

test('a debit note is issued after a confirmation of each charge, and opens as the new document', async ({
  page,
  api,
}) => {
  // The contract's reason example has no billing adjustment reason (CR-030), so the test gives the seeded ones.
  api.rewrite('listReasonCodes', (body) => ({
    ...(body as object),
    data: [
      {
        code: 'UNDERCHARGED',
        domain: 'BILLING_ADJUSTMENT',
        description: 'Undercharged',
        requiresNote: true,
        lossAccountGroup: null,
      },
      {
        code: 'CHARGE_OMITTED',
        domain: 'BILLING_ADJUSTMENT',
        description: 'A charge was left off',
        requiresNote: false,
        lossAccountGroup: null,
      },
    ],
    page: { nextCursor: null, limit: 100, hasMore: false },
  }));
  await signInWithTotp(page, USERS.owner, `/billing-documents/${RECEIPT}/debit-note`);
  await expect(
    page.getByRole('heading', { level: 1, name: `Debit note against ${NAME}` }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: /^Reason/ }).click();
  await page.getByRole('option', { name: 'A charge was left off' }).click();
  await page
    .getByRole('textbox', { name: /^What charge 1 is for/ })
    .fill('Second delivery attempt');
  await page.getByRole('textbox', { name: /^Amount of charge 1/ }).fill('30');
  await page.getByRole('combobox', { name: /^Tax category of charge 1/ }).click();
  await page.getByRole('option', { name: 'Delivery Service' }).click();
  await page.getByRole('button', { name: 'Review the debit note' }).click();
  const confirm = page.getByRole('dialog', { name: 'Issue this debit note?' });
  await expect(confirm).toContainText('Second delivery attempt, Delivery Service:');
  await expect(confirm).toContainText('GH₵30.00');
  await confirm.getByRole('button', { name: 'Issue the debit note' }).click();
  await expect(page.getByText('The debit note was issued')).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'issueDebitNote')).toHaveLength(1);
});

test('a storekeeper opening the documents sees permission denied in words', async ({ page }) => {
  await signIn(page, USERS.storekeeper, '/billing-documents');
  await expect(
    page.getByText(/do not have access|does not include the permission/i).first(),
  ).toBeVisible();
});

for (const [path, ready] of [
  ['/billing-documents', 'Invoice INV-2026-DDW-001198'],
  [`/billing-documents/${RECEIPT}`, 'Reprint history'],
  [`/billing-documents/${RECEIPT}/credit-note`, 'What to credit'],
  [`/billing-documents/${RECEIPT}/debit-note`, 'Charges'],
  ['/statements', 'STM-2026-DDW-000031'],
  ['/statements/019a7b05-ca26-7b67-a09f-bf4984173827', 'Balance brought forward'],
  ['/statements/new', 'Draw up a statement'],
] as const) {
  test(`${path} at 360 px: axe clean, no sideways scroll`, async ({ page }) => {
    await signInWithTotp(page, USERS.owner, path);
    await expect(page.getByText(ready).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
