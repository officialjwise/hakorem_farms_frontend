/**
 * The F5b screens against the REAL Prism mock (ADR 0019), through the app's own routes and shell: the
 * dashboard and branches in their states, the dashboard's unavailable figures, and a branch close the
 * server refuses, shown in the server's words.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';
import { NOT_IN_CONTRACT } from './figures';

/** Prism's 500 reference (`019a7b1e-…-970f89c10fed`) as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_500_REFERENCE = '89c1 0fed';
// updateBranch's first named 422 example, farmBranch (CR-017, contract 1.21.0).
/** Prism's 422 reference (`019a7b20-…-2b6d8c1a0e11`) as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_422_REFERENCE = '8c1a 0e11';
const ANY_ID = '019a7a86-3046-711a-a652-1a7389f79351';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('the dashboard against the Prism mock', () => {
  it('loading: says what is coming, then today’s figures', async () => {
    const release = holdResponses();
    await renderApp('/', await signedIn('owner'));
    // The first screen of a file is cold (its lazy chunk and words load first): F5b's 5 s allowance.
    expect(
      (await screen.findAllByText("Loading today's figures", {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    expect(await screen.findByText('Selling best today')).toBeInTheDocument();
  });

  it('shows the API’s figures, with the series behind them, and names only what the contract lacks', async () => {
    await renderApp('/', await signedIn('owner'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const tileOf = (label: string) =>
      screen.getByText(label).closest('[data-slot="stat-tile"]') as HTMLElement;
    // allFiguresLive, the mock's default (1.21.1): every figure the contract carries is filled.
    await screen.findByText('Sales today');
    expect(tileOf('Sales today')).toHaveTextContent('16,223.00');
    expect(tileOf('Sales today')).toHaveTextContent('Yesterday');
    // 1.21.0's new figures, each leaving the pending strip.
    expect(tileOf('Purchases today')).toHaveTextContent('18,435.01 over the week, 6 receipts');
    expect(tileOf('Low stock')).toHaveTextContent('1 product');
    expect(tileOf('Animals on hand')).toHaveTextContent('6 head');
    expect(tileOf('Animals on hand')).toHaveTextContent('Goat 4 · Sheep 2');
    // The series are the API's points, drawn and named with the dates they cover.
    expect(
      screen.getByRole('img', { name: /Sales per day, 2026-11-09 to 2026-11-15/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Purchases per day at cost, 2026-11-09 to 2026-11-15/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Goat')).toBeInTheDocument();
    // What the contract has no field for at all is still named in the strip, with no figure.
    const pending = screen.getByRole('region', { name: 'Figures still to come from the server' });
    for (const label of ['Stock health', 'Invoices', 'Payments by method']) {
      expect(within(pending).getByText(label)).toHaveAttribute('data-slot', 'pending-figure');
    }
    expect(within(pending).queryByText('Animals on hand')).toBeNull();
    expect(pending.textContent).not.toMatch(/\d/);
    expect(NOT_IN_CONTRACT).not.toContain('animalsOnHand');
  });

  it('before the exception report: each figure the server lists as pending is named, never a zero', async () => {
    // 1.52.0: the sales figures answer numbers; only the alerts and today's exceptions wait for B12.
    mock.prefer = 'example=beforeExceptionReport';
    mock.preferPath = '/dashboard';
    await renderApp('/', await signedIn('owner'));
    const pending = await screen.findByRole('region', {
      name: 'Figures still to come from the server',
    });
    for (const label of ['Needs attention', 'Exceptions recorded today']) {
      expect(within(pending).getByText(label)).toHaveAttribute('data-slot', 'pending-figure');
    }
    expect(pending.textContent).not.toMatch(/\d/);
    for (const label of ['Sales today', 'Sales this month', 'Owed by customers', 'Cash on hand']) {
      expect(within(pending).queryByText(label)).toBeNull();
    }
    const money = screen.getByRole('region', { name: 'Today at a glance' });
    expect(within(money).getByText('Owed by customers')).toBeInTheDocument();
    expect(within(money).getByText('Cash on hand')).toBeInTheDocument();
    const row = screen.getByRole('region', { name: 'Stock and animals' });
    expect(within(row).getByText('Stock value')).toBeInTheDocument();
    expect(within(row).getByText('Animals on hand')).toBeInTheDocument();
  });

  it('the stat tiles lead to the screens behind them', async () => {
    await renderApp('/', await signedIn('owner'));
    const stock = await screen.findByRole('link', { name: /Stock value/ });
    expect(stock).toHaveAttribute('href', '/stock');
  });

  it('error: what failed, the reference from the mock, and a retry', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/dashboard';
    await renderApp('/', await signedIn('owner'));
    await waitFor(() => expect(alertWith("Today's figures could not be loaded")).toBeDefined());
    const alert = alertWith("Today's figures could not be loaded") as HTMLElement;
    expect(alert).toHaveTextContent(PRISM_500_REFERENCE);
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('permission denied: the server’s 403 in words, with no retry', async () => {
    mock.prefer = 'code=403';
    mock.preferPath = '/dashboard';
    await renderApp('/', await signedIn('owner'));
    await waitFor(() => expect(alertWith('The dashboard is for the owner')).toBeDefined());
    const alert = alertWith('The dashboard is for the owner') as HTMLElement;
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('a role without the dashboard meets the start page in words, without asking the server', async () => {
    await renderApp('/', await signedIn('storekeeper'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(alertWith('The dashboard is for the owner')).toBeDefined());
  });
});

describe('branches against the Prism mock', () => {
  it('loading, then the branches with their status in words', async () => {
    const release = holdResponses();
    await renderApp('/branches', await signedIn('owner'));
    expect((await screen.findAllByText('Loading branches')).length).toBeGreaterThan(0);
    release();
    expect(await screen.findByRole('link', { name: 'HaKorem Farms, Dodowa' })).toBeInTheDocument();
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0);
  });

  it('empty: no branches yet, in words', async () => {
    mock.noRows = true;
    await renderApp('/branches', await signedIn('owner'));
    expect(await screen.findByText('No branches yet')).toBeInTheDocument();
  });

  it('error and permission denied, in words', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/branches';
    await renderApp('/branches', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Branches could not be loaded')).toHaveTextContent(PRISM_500_REFERENCE),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/branches', await signedIn('owner'));
    await waitFor(() => expect(alertWith('You do not have access to branches')).toBeDefined());
  });

  it('a branch shows its facts and its locations', async () => {
    await renderApp(`/branches/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'HaKorem Farms, Dodowa' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Locations in this branch' }),
    ).toBeInTheDocument();
  });

  it('closing asks first with the change, and the server’s refusal stays in the dialog, in its words', async () => {
    const user = userEvent.setup();
    await renderApp(`/branches/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Close the branch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Close HaKorem Farms, Dodowa?' });
    expect(within(dialog).getByRole('row', { name: 'Status Active Closed' })).toBeInTheDocument();
    // The client does not guess (for example "last active branch"): the server answers, here with 422.
    mock.prefer = 'code=422';
    await user.click(within(dialog).getByRole('button', { name: 'Close the branch' }));
    const refusal = await within(dialog).findByRole('alert');
    expect(refusal).toHaveTextContent('The branch was not closed');
    expect(refusal).toHaveTextContent('This branch cannot be closed.');
    expect(refusal).toHaveTextContent(PRISM_422_REFERENCE);
  });
});

interface ListCase {
  screen: string;
  path: string;
  ready: string | RegExp;
  loading: string;
  empty: string;
  error: string;
  denied: string;
}

const LISTS: ListCase[] = [
  {
    screen: 'lots and expiry',
    path: '/lots',
    ready: 'G-0142',
    loading: 'Loading lots',
    empty: 'No lots here',
    error: 'Lots could not be loaded',
    denied: 'You do not have access to stock',
  },
  {
    screen: 'stock movements',
    path: '/movements',
    ready: /Sale issue/,
    loading: 'Loading stock movements',
    empty: 'No movements yet',
    error: 'Stock movements could not be loaded',
    denied: 'You do not have access to stock movements',
  },
  {
    screen: 'suppliers',
    path: '/suppliers',
    ready: 'Kpone Livestock Traders',
    loading: 'Loading suppliers',
    empty: 'No suppliers yet',
    error: 'Suppliers could not be loaded',
    denied: 'You do not have access to suppliers',
  },
  {
    screen: 'cash registers',
    path: '/registers',
    ready: 'Shift open',
    loading: 'Loading cash registers',
    empty: 'No cash registers yet',
    error: 'Cash registers could not be loaded',
    denied: 'You do not have access to cash registers',
  },
  {
    screen: 'labels',
    path: '/labels',
    ready: 'LIV-0004',
    loading: 'Loading products',
    empty: 'No products match',
    error: 'Products could not be loaded',
    denied: 'You do not have access to products',
  },
];

describe.each(LISTS)('the $screen screen against the Prism mock', (c) => {
  it('loading, then the data the mock served', async () => {
    const release = holdResponses();
    await renderApp(c.path, await signedIn('owner'));
    // The first case in a file loads its screen's modules cold: allow for it.
    expect((await screen.findAllByText(c.loading, {}, { timeout: 5000 })).length).toBeGreaterThan(
      0,
    );
    release();
    expect((await screen.findAllByText(c.ready)).length).toBeGreaterThan(0);
  });

  it('empty, error with its reference, and permission denied, in words', async () => {
    mock.noRows = true;
    await renderApp(c.path, await signedIn('owner'));
    expect((await screen.findAllByText(c.empty, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() => expect(alertWith(c.error)).toHaveTextContent(PRISM_500_REFERENCE));
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() => expect(alertWith(c.denied)).toBeDefined());
    expect(
      within(alertWith(c.denied) as HTMLElement).queryByRole('button', { name: 'Try again' }),
    ).toBeNull();
  });
});
