/**
 * The reports against the REAL Prism mock (ADR 0019): the list in its groups, the ledger's statements from
 * their own operations, and the reports whose codes the contract does not list yet (CR-060, CR-061), which
 * say so in words. An egg report answered by the API, and a statement's file, are in the e2e spec, where
 * the fake API can list their codes.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { mock } from '../test/integration-setup';

afterEach(() => {
  queryClient.clear();
});

describe('the reports', () => {
  it('lists every report in its group, and says which wait for the backend', async () => {
    await renderApp('/reports', await signedIn('owner'));
    const eggs = await screen.findByRole('region', { name: 'Eggs' }, { timeout: 5000 });
    const margin = within(eggs).getByRole('link', { name: /Margin per crate/ });
    await waitFor(() => expect(margin).toHaveTextContent('Waits for the backend (CR-060)'));
    expect(
      within(screen.getByRole('region', { name: 'Tax' })).getByRole('link', { name: /VAT return/ }),
    ).toHaveTextContent('Waits for the backend (CR-061)');
    const ledger = screen.getByRole('region', { name: 'The ledger' });
    for (const name of ['Profit and loss', 'Balance sheet', 'Trial balance']) {
      expect(within(ledger).getByRole('link', { name: new RegExp(name) })).not.toHaveTextContent(
        'Waits for the backend',
      );
    }
  });

  it('the balance sheet at a date: its sections, their totals, and its checks in words', async () => {
    await renderApp('/reports/balance-sheet', await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Balance sheet' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    const totals = await screen.findByRole('list', { name: 'Totals for the period' });
    expect(totals).toHaveTextContent('Assets');
    expect(totals).toHaveTextContent('GH₵462,330.00');
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Accumulated depreciation');
    expect(table).toHaveTextContent('Total Equity');
    expect(screen.getByText(/checks? passed/)).toBeInTheDocument();
    expect(screen.getByLabelText('As at')).toHaveValue();
    // Until CR-062 lists the statement's code, its only file is the page as CSV.
    await userEvent.setup().click(screen.getByRole('button', { name: /^Export/ }));
    expect(screen.queryByRole('menuitem', { name: 'PDF' })).toBeNull();
  });

  it('the trial balance: each account, the API totals, and whether it balances', async () => {
    await renderApp('/reports/trial-balance', await signedIn('owner'));
    await waitFor(
      () => expect(screen.getByRole('table')).toHaveTextContent('1000 Cash on hand, tills'),
      { timeout: 5000 },
    );
    expect(screen.getByRole('table')).toHaveTextContent('GH₵2,556.00');
    expect(screen.getByText(/The trial balance balances/)).toBeInTheDocument();
  });

  it('an egg report waits for the backend until the API lists its code', async () => {
    await renderApp('/reports/egg-breakage', await signedIn('owner'));
    expect(
      await screen.findByText(/waits for the backend \(CR-060\)/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Egg breakage' })).toBeInTheDocument();
  });

  it('a statement denied to the caller says so in words', async () => {
    mock.prefer = 'code=403';
    mock.preferPath = '/finance/trial-balance';
    await renderApp('/reports/trial-balance', await signedIn('owner'));
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('alert')
            .some((alert) => alert.textContent?.includes('You do not have access to this report')),
        ).toBe(true),
      { timeout: 5000 },
    );
  });
});
