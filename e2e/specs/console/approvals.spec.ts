import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

const ANY = '019a7a98-6f3f-7645-9b7d-6d2c515ee60a';
/** The test fake's Manager (fakeAuthServer.ts), who holds liv.mortality.approve. */
const MANAGER = { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', displayName: 'Kwabena Owusu' };
/** A small grey picture, so the page never fetches the example's signed link from the network. */
const PICTURE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDMiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9ImdyYXkiLz48L3N2Zz4=';

type Approval = Record<string, unknown>;

/** The contract's G-0171 death, as the MORTALITY_WRITE_OFF it waits as since 1.24.0. */
const mortality = (body: unknown, changes: Approval = {}): Approval => ({
  ...(body as Approval),
  id: ANY,
  kind: 'MORTALITY_WRITE_OFF',
  status: 'PENDING',
  subject: {
    id: '019a7ac0-1177-71b6-96ef-24403c269d1e',
    docType: 'MORTALITY_RECORD',
    number: null,
  },
  summary: 'Death of G-0171 (DISEASE_SUSPECTED), valued 58900 pesewas',
  amountPesewas: 58900,
  evidenceFileId: '019a7ac0-3066-7b9a-a0d2-c277b5d73b55',
  requestedBy: { id: '019a7a87-08cf-7652-9b8a-6df7ddcee6d5', displayName: 'Abena Quaye' },
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  canDecide: true,
  ...changes,
});

test.describe('the approvals inbox', () => {
  test('a manager sees what waits on them, every kind on offer, at 360 px', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.manager, '/approvals');
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Waiting on me', selected: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Void a sale' }).first()).toBeVisible();
    // "Waiting on me" is the server's decidableByMe: the maker's own requests are never in it.
    const asked = api.log.filter((e) => e.operationId === 'listApprovals').map((e) => e.path);
    expect(asked.length).toBeGreaterThan(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('combobox', { name: 'Kind' }).click();
    await expect(page.getByRole('option', { name: 'Death or cull write-off' })).toBeVisible();
  });

  test('a death waits with its evidence, photograph and value, then the manager approves it', async ({
    page,
    api,
  }) => {
    api.rewrite('getApproval', (body) => mortality(body));
    api.rewrite('getFile', (body) => ({
      ...(body as Approval),
      scanStatus: 'CLEAN',
      purpose: 'EVIDENCE',
    }));
    api.rewrite('createFileSignedUrl', (body) => ({ ...(body as Approval), url: PICTURE }));
    api.rewrite('approveRequest', (body) =>
      mortality(body, { status: 'APPROVED', canDecide: false, decidedBy: MANAGER }),
    );
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Death or cull write-off' }),
    ).toBeVisible();
    const evidence = page.getByRole('region', { name: 'Evidence' });
    await expect(evidence).toContainText('GH₵589.00');
    await expect(evidence).toContainText('Abena Quaye');
    await expect(
      page.getByRole('img', { name: 'The photograph attached to this request' }),
    ).toBeVisible();
    // The record itself, for a role that reads deaths: the animal and the value written off.
    await expect(page.getByText('G-0171').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve this Death or cull write-off?' });
    await expect(dialog).toContainText('GH₵589.00');
    await dialog.getByLabel('Reason').fill('Checked the carcass photograph with the vet');
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved. It has taken effect.')).toBeVisible();
    expect(api.log.filter((e) => e.operationId === 'approveRequest')).toHaveLength(1);
  });

  test('the maker sees no Approve on their own request, only Withdraw, and why', async ({
    page,
    api,
  }) => {
    api.rewrite('getApproval', (body) =>
      mortality(body, { requestedBy: MANAGER, canDecide: false }),
    );
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await expect(page.getByText('You asked for this, so you cannot decide it')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Withdraw my request' })).toBeVisible();
    await expectNoAxeViolations(page);
    expect(api.log.filter((e) => e.operationId === 'approveRequest')).toHaveLength(0);
  });

  test('when the server refuses the maker, the refusal stays in the dialog in words', async ({
    page,
    api,
  }) => {
    api.rewrite('getApproval', (body) => mortality(body));
    api.refuse(
      'approveRequest',
      422,
      'MAKER_CANNOT_CHECK',
      'The maker of a request cannot check it.',
    );
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: /^Approve this/ });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('It was not approved');
    await expect(alert).toContainText('You made this request, so you cannot approve or reject it.');
    // The reference's last eight characters, grouped, with a button that copies all of it (ADR 0051).
    await expect(alert).toContainText('35ea bc69');
    await expect(alert).not.toContainText('019a7b1d-5a33-73ab-98e3-438b35eabc69');
    await expect(alert.getByRole('button', { name: 'Copy the full reference' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('rejecting needs a reason, which the person who asked is shown', async ({ page, api }) => {
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await page.getByRole('button', { name: 'Reject' }).click();
    const dialog = page.getByRole('dialog', { name: /^Reject this/ });
    await expect(dialog).toContainText('GH₵1,275.00');
    await dialog.getByRole('textbox').fill('The goat was sold, not returned');
    await dialog.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Rejected. Nothing took effect.')).toBeVisible();
    expect(api.log.filter((e) => e.operationId === 'rejectRequest')).toHaveLength(1);
  });

  test('a role without the inbox meets it as permission denied, in words', async ({ page }) => {
    await signIn(page, USERS.cashier, '/approvals');
    await expect(page.getByRole('alert')).toContainText('You do not have access to this page');
    await expect(page.getByRole('alert')).toContainText('iam.approval.read');
  });
});

test.describe('a processing reversal (CR-027)', () => {
  const REVERSAL = '019a7ab2-5b51-7c7a-9f4e-0a3c3c2b6d11';
  const ORDER = '019a7ab0-8a14-7d2e-b0c4-5d0f1e9a2b37';
  const reversal = (body: unknown): Approval => ({
    ...(body as Approval),
    id: ANY,
    kind: 'PROCESSING_REVERSAL',
    status: 'PENDING',
    subject: { id: REVERSAL, docType: 'PROCESSING_REVERSAL', number: null },
    summary: 'Reverse the processing of G-0109, valued 67800 pesewas (Wrong goat slaughtered)',
    amountPesewas: 67800,
    evidenceFileId: null,
    canDecide: true,
  });

  test('links to its processing order, found by the reversal in one read', async ({
    page,
    api,
  }) => {
    api.rewrite('getApproval', (body) => reversal(body));
    api.rewrite('listProcessingOrders', (body) => {
      const page = body as { data: Approval[] };
      return { ...page, data: [{ ...page.data[0], id: ORDER, orderNo: 'PRC-2026-DDW-000012' }] };
    });
    const asked = page.waitForRequest(
      (r) => r.url().includes('/processing-orders?') && r.url().includes(`reversalId=${REVERSAL}`),
    );
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await asked;
    const evidence = page.getByRole('region', { name: 'Evidence' });
    const link = evidence.getByRole('link', { name: 'Open processing order PRC-2026-DDW-000012' });
    await expect(link).toHaveAttribute('href', `/processing-orders/${ORDER}`);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test('says so in words when its order is not found', async ({ page, api }) => {
    api.rewrite('getApproval', (body) => reversal(body));
    api.rewrite('listProcessingOrders', (body) => ({ ...(body as Approval), data: [] }));
    await signInWithTotp(page, USERS.manager, `/approvals/${ANY}`);
    await expect(page.getByRole('region', { name: 'Evidence' })).toContainText(
      'Its processing order was not found.',
    );
  });
});
