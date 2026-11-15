/**
 * Every F5 screen against the REAL Prism mock (ADR 0019), mounted through the app's own routes, shell and
 * providers, in its four states, as the F3 screens are: loading (a held answer), empty (a list with no rows
 * until CR-005, or the contract's 404 for a record), error (the contract's 500 and its reference) and
 * permission denied (the contract's 403 in words, with no retry). Then the gate's writes: a count saved
 * page by page and counting finished.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

const PRISM_500_REFERENCE = '019a7b1e-32bc-78e3-8e1c-970f89c10fed';
const ANY_ID = '019a7a86-3046-711a-a652-1a7389f79351';
/** The counting stock take in the contract's `getStockTake` example; writes go to its own id. */
const COUNTING_ID = '019a7aba-06c9-7349-b881-3d6a7794b648';

afterEach(() => {
  queryClient.clear();
});

interface Case {
  screen: string;
  path: string;
  ready: RegExp | string;
  loading: string;
  empty: string;
  emptyBy: 'noRows' | '404';
  error: string;
  denied: string;
}

const CASES: Case[] = [
  {
    screen: 'stock on hand',
    path: `/stock`,
    ready: 'Goat meat, 15 kg pack',
    loading: 'Loading stock on hand',
    empty: 'No stock here',
    emptyBy: 'noRows',
    error: 'Stock on hand could not be loaded',
    denied: 'You do not have access to stock',
  },
  {
    screen: 'stock takes',
    path: `/stock-takes`,
    ready: 'Feed and produce store',
    loading: 'Loading stock takes',
    empty: 'No stock takes yet',
    emptyBy: 'noRows',
    error: 'Stock takes could not be loaded',
    denied: 'You do not have access to stock takes',
  },
  {
    screen: 'stock take',
    path: `/stock-takes/${ANY_ID}`,
    ready: 'Shop floor, STK-2026-DDW-000014',
    loading: 'Loading the stock take',
    empty: 'There is no stock take at this address',
    emptyBy: '404',
    error: 'This stock take could not be loaded',
    denied: 'You do not have access to this stock take',
  },
  {
    screen: 'adjustments',
    path: `/stock-adjustments`,
    ready: 'ADJ-2026-DDW-000038',
    loading: 'Loading adjustments',
    empty: 'No adjustments yet',
    emptyBy: 'noRows',
    error: 'Adjustments could not be loaded',
    denied: 'You do not have access to adjustments',
  },
  {
    screen: 'adjustment',
    path: `/stock-adjustments/${ANY_ID}`,
    ready: 'Yam, tuber',
    loading: 'Loading the adjustment',
    empty: 'There is no adjustment at this address',
    emptyBy: '404',
    error: 'This adjustment could not be loaded',
    denied: 'You do not have access to adjustments',
  },
  {
    screen: 'new adjustment',
    path: `/stock-adjustments/new`,
    ready: 'Save the draft',
    loading: 'Loading locations',
    empty: 'There are no locations to choose from',
    emptyBy: 'noRows',
    error: 'Locations could not be loaded',
    denied: 'You cannot see the locations this needs',
  },
  {
    screen: 'transfers',
    path: `/stock-transfers`,
    ready: 'TRF-2026-DDW-00009',
    loading: 'Loading transfers',
    empty: 'No transfers yet',
    emptyBy: 'noRows',
    error: 'Transfers could not be loaded',
    denied: 'You do not have access to transfers',
  },
  {
    screen: 'transfer',
    path: `/stock-transfers/${ANY_ID}`,
    ready: 'Goat meat, 15 kg pack',
    loading: 'Loading the transfer',
    empty: 'There is no transfer at this address',
    emptyBy: '404',
    error: 'This transfer could not be loaded',
    denied: 'You do not have access to transfers',
  },
  {
    screen: 'new transfer',
    path: `/stock-transfers/new`,
    ready: 'Save the draft',
    loading: 'Loading locations',
    empty: 'There are no locations to choose from',
    emptyBy: 'noRows',
    error: 'Locations could not be loaded',
    denied: 'You cannot see the locations this needs',
  },
  {
    screen: 'goods receipts',
    path: `/goods-receipts`,
    ready: 'GRN-2026-DDW-000072',
    loading: 'Loading goods receipts',
    empty: 'No goods receipts yet',
    emptyBy: 'noRows',
    error: 'Goods receipts could not be loaded',
    denied: 'You do not have access to goods receipts',
  },
  {
    screen: 'goods receipt',
    path: `/goods-receipts/${ANY_ID}`,
    ready: 'GRN-2026-DDW-000072',
    loading: 'Loading the goods receipt',
    empty: 'There is no goods receipt at this address',
    emptyBy: '404',
    error: 'This goods receipt could not be loaded',
    denied: 'You do not have access to goods receipts',
  },
  {
    screen: 'new goods receipt',
    path: `/goods-receipts/new`,
    ready: 'Save the draft',
    loading: 'Loading locations',
    empty: 'There are no locations to choose from',
    emptyBy: 'noRows',
    error: 'Locations could not be loaded',
    denied: 'You cannot see the locations this needs',
  },
];

describe.each(CASES)('the $screen screen against the Prism mock', (c) => {
  it('loading: a placeholder that names what is coming, then the data the mock served', async () => {
    const release = holdResponses();
    await renderApp(c.path, await signedIn('owner'));
    // The first case in a file loads its screen's modules cold: allow for it.
    expect((await screen.findAllByText(c.loading, {}, { timeout: 5000 })).length).toBeGreaterThan(
      0,
    );
    release();
    expect((await screen.findAllByText(c.ready)).length).toBeGreaterThan(0);
  });

  it(`empty: ${c.emptyBy === 'noRows' ? 'a list with no rows' : 'a record that is not there'} says so in words`, async () => {
    if (c.emptyBy === 'noRows') mock.noRows = true;
    else mock.prefer = 'code=404';
    await renderApp(c.path, await signedIn('owner'));
    expect((await screen.findAllByText(c.empty, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
  });

  it('error: what failed, the reference from the mock, and a retry', async () => {
    mock.prefer = 'code=500';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(c.error)),
      ).toBe(true),
    );
    const alert = screen.getAllByRole('alert').find((a) => a.textContent?.includes(c.error));
    expect(alert).toHaveTextContent(PRISM_500_REFERENCE);
    expect(within(alert as HTMLElement).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('permission denied: the server’s 403 in words, with no retry', async () => {
    mock.prefer = 'code=403';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(c.denied)),
      ).toBe(true),
    );
    const alert = screen.getAllByRole('alert').find((a) => a.textContent?.includes(c.denied));
    expect(within(alert as HTMLElement).queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('the F5 gate: a count is entered page by page, blind, and finished', () => {
  it('never shows the expected quantity while counting, and saves what was typed', async () => {
    const user = userEvent.setup();
    await renderApp(`/stock-takes/${ANY_ID}`, await signedIn('storekeeper'));
    const form = await screen.findByRole('form', { name: 'Counts for this page' });
    expect(within(form).queryByText(/40\.000|expected/i)).toBeNull();
    const yam = within(form).getByLabelText(/^Yam, tuber, Tuber/);
    await user.type(yam, '34');
    await user.click(within(form).getByRole('button', { name: 'Save counts on this page' }));
    expect(await screen.findByText('1 count saved')).toBeInTheDocument();
  });

  it('a weighed line takes three places and saves them', async () => {
    const user = userEvent.setup();
    await renderApp(`/stock-takes/${ANY_ID}`, await signedIn('storekeeper'));
    const form = await screen.findByRole('form', { name: 'Counts for this page' });
    await user.type(
      within(form).getAllByLabelText(/^Goat meat, 15 kg pack/)[0] as HTMLElement,
      '29.75',
    );
    await user.click(within(form).getByRole('button', { name: 'Save counts on this page' }));
    expect(await screen.findByText('1 count saved')).toBeInTheDocument();
  });

  it('finishing asks first with how many lines are counted, and a refusal stays in the dialog', async () => {
    const user = userEvent.setup();
    mock.prefer = 'code=500';
    mock.preferPath = `/stock-takes/${COUNTING_ID}/review`;
    await renderApp(`/stock-takes/${ANY_ID}`, await signedIn('storekeeper'));
    await user.click(await screen.findByRole('button', { name: 'Finish counting' }));
    const dialog = await screen.findByRole('dialog', { name: 'Finish counting?' });
    expect(dialog).toHaveTextContent('11 of 24 lines are counted');
    await user.click(within(dialog).getByRole('button', { name: 'Finish counting' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(PRISM_500_REFERENCE);
  });
});
