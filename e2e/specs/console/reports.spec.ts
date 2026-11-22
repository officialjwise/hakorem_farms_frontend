import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

type Body = Record<string, unknown>;

const OWNER = { id: '019a7a86-1c4e-7b9a-9e2f-5d3c8a1b7e04', displayName: 'Ama Mensah' };

/** A report definition as `listReportDefinitions` lists one. */
const definition = (code: string, name: string, category = 'OPERATIONAL') => ({
  code,
  name,
  category,
  parameters: {},
  formats: ['SCREEN', 'PDF', 'XLSX'],
  canExport: true,
  isBulk: false,
});

/** A `ReportRun` in the contract's shape, for the code and format the console asked for. */
const reportRun = (request: unknown, path: string, result: Body | null) => {
  const { parameters, format } = request as { parameters: Body; format: string };
  const code = path.split('/')[2] ?? '';
  return {
    id: '019a7c00-0000-7000-8000-000000000001',
    reportCode: code,
    parameters,
    format,
    status: 'READY',
    rowCount: result === null ? 0 : (result.rows as unknown[]).length,
    result: format === 'SCREEN' ? result : null,
    file:
      format === 'SCREEN'
        ? null
        : {
            url: `https://files.example.com/${code}.${format.toLowerCase()}`,
            expiresAt: '2026-11-22T18:05:00Z',
          },
    dataAsOf: '2026-11-22T17:00:00Z',
    createdAt: '2026-11-22T17:00:00Z',
    createdBy: OWNER,
  };
};

/** The margin per crate as CR-060 asks the server to give it: every figure the server's. */
const CRATE_MARGIN = {
  columns: [
    { key: 'branch', label: 'Shop', type: 'TEXT' },
    { key: 'crates', label: 'Crates sold', type: 'INTEGER' },
    { key: 'costPerCrate', label: 'Cost per crate after breakage', type: 'PESEWAS' },
    { key: 'pricePerCrate', label: 'Price per crate', type: 'PESEWAS' },
    { key: 'marginPerCrate', label: 'Margin per crate', type: 'PESEWAS' },
    { key: 'marginPercent', label: 'Margin', type: 'PERCENT' },
  ],
  rows: [
    {
      branch: 'Kasoa shop',
      crates: 120,
      costPerCrate: 5240,
      pricePerCrate: 6500,
      marginPerCrate: 1260,
      marginPercent: '19.38',
    },
    {
      branch: 'KNUST shop',
      crates: 85,
      costPerCrate: 5310,
      pricePerCrate: 6500,
      marginPerCrate: 1190,
      marginPercent: '18.31',
    },
  ],
  totals: { crates: 205, marginPerCrate: 1231 },
};

/** The VAT return as CR-061 asks for it: one row per levy, the net due in the totals. */
const VAT_RETURN = {
  columns: [
    { key: 'levy', label: 'Levy', type: 'TEXT' },
    { key: 'rate', label: 'Rate', type: 'PERCENT' },
    { key: 'base', label: 'Taxable base', type: 'PESEWAS' },
    { key: 'output', label: 'Output tax', type: 'PESEWAS' },
    { key: 'input', label: 'Input tax reclaimable', type: 'PESEWAS' },
    { key: 'net', label: 'Net due', type: 'PESEWAS' },
  ],
  rows: [
    { levy: 'VAT', rate: '15.00', base: 2840000, output: 426000, input: 98000, net: 328000 },
    { levy: 'NHIL', rate: '2.50', base: 2840000, output: 71000, input: 0, net: 71000 },
    { levy: 'GETFund Levy', rate: '2.50', base: 2840000, output: 71000, input: 0, net: 71000 },
  ],
  totals: { output: 568000, input: 98000, net: 470000 },
};

test.describe('the reports, once the API lists their codes (CR-060 to CR-062)', () => {
  test.beforeEach(({ api }) => {
    api.rewrite('listReportDefinitions', (body) => ({
      ...(body as Body),
      data: [
        ...((body as { data: Body[] }).data ?? []),
        definition('EGG_CRATE_MARGIN', 'Margin per crate'),
        definition('VAT_RETURN', 'VAT return', 'FINANCIAL'),
        definition('PROFIT_AND_LOSS', 'Profit and loss', 'FINANCIAL'),
      ],
    }));
    api.respond('runReport', (request, path) => {
      const code = path.split('/')[2];
      const result =
        code === 'EGG_CRATE_MARGIN' ? CRATE_MARGIN : code === 'VAT_RETURN' ? VAT_RETURN : null;
      return reportRun(request, path, result);
    });
  });

  test('the owner reads the margin per crate after breakage, as the server states it', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/reports');
    const eggs = page.getByRole('region', { name: 'Eggs' });
    const margin = eggs.getByRole('link', { name: /Margin per crate/ });
    await expect(margin).not.toContainText('Waits for the backend');
    // Breakage is not listed yet, so it still says it waits.
    await expect(eggs.getByRole('link', { name: /Egg breakage/ })).toContainText(
      'Waits for the backend (CR-060)',
    );
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await margin.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Margin per crate' })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table).toContainText('Kasoa shop');
    await expect(table).toContainText('GH₵12.60');
    await expect(table).toContainText('19.38%');
    // The totals are the server's, never added up here.
    const totals = page.getByRole('list', { name: 'Totals for the period' });
    await expect(totals).toContainText('205');
    await expect(totals).toContainText('GH₵12.31');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    const runs = api.log.filter((entry) => entry.operationId === 'runReport');
    expect(runs.map((entry) => entry.path)).toContain('/reports/EGG_CRATE_MARGIN/run');
  });

  test('the VAT return: VAT, NHIL and GETFund as the API gives them, and as a file', async ({
    page,
  }) => {
    await signInWithTotp(page, USERS.owner, '/reports/vat-return');
    await expect(page.getByRole('heading', { level: 1, name: 'VAT return' })).toBeVisible();
    const table = page.getByRole('table');
    for (const levy of ['VAT', 'NHIL', 'GETFund Levy']) await expect(table).toContainText(levy);
    await expect(table).toContainText('GH₵3,280.00');
    await expect(page.getByRole('list', { name: 'Totals for the period' })).toContainText(
      'GH₵4,700.00',
    );
    await page.getByRole('button', { name: /^Export/ }).click();
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
      'href',
      'https://files.example.com/VAT_RETURN.pdf',
    );
    await expectNoAxeViolations(page);
  });

  test('profit and loss offers its file once runReport lists its code', async ({ page, api }) => {
    await signInWithTotp(page, USERS.owner, '/reports/profit-and-loss');
    await expect(page.getByRole('heading', { level: 1, name: 'Profit and loss' })).toBeVisible();
    await page.getByRole('button', { name: /^Export/ }).click();
    await page.getByRole('button', { name: 'Spreadsheet (XLSX)' }).click();
    await expect(page.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
      'href',
      'https://files.example.com/PROFIT_AND_LOSS.xlsx',
    );
    const sent = api.log.filter((entry) => entry.operationId === 'runReport');
    expect(sent.map((entry) => entry.path)).toEqual(['/reports/PROFIT_AND_LOSS/run']);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the ledger's statements, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const [path, heading] of [
      ['/reports/balance-sheet', 'Balance sheet'],
      ['/reports/trial-balance', 'Trial balance'],
    ] as const) {
      test(`${heading} reads from the ledger at 360 px`, async ({ page }) => {
        await signInWithTotp(page, USERS.owner, path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page.getByRole('table')).toBeVisible();
        await expect(page.getByText(/balances|checks? passed/).first()).toBeVisible();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}
