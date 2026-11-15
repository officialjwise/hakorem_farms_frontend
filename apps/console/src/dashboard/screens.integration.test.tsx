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
import { UNAVAILABLE } from './figures';

const PRISM_500_REFERENCE = '019a7b1e-32bc-78e3-8e1c-970f89c10fed';
const PRISM_422_REFERENCE = '019a7b1d-f4de-751c-aa55-5aa0965fd37e';
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
    expect((await screen.findAllByText("Loading today's figures")).length).toBeGreaterThan(0);
    release();
    expect(await screen.findByText('Selling best today')).toBeInTheDocument();
  });

  it('shows the API’s figures, and every figure with no data source in words, never as a number', async () => {
    await renderApp('/', await signedIn('owner'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    // Live in contract 1.17.0: sales today (16,223.00 in the example), stock at cost, receivables.
    const sales = (await screen.findByText('Sales today')).closest(
      '[data-slot="stat-tile"]',
    ) as HTMLElement;
    expect(sales).toHaveTextContent('16,223.00');
    expect(sales).toHaveTextContent('Yesterday');
    expect(screen.getByText('Goat')).toBeInTheDocument();
    // Not in the contract yet: the tile says so and carries no figure.
    for (const label of ['Purchases today', 'Low stock', 'Animals on hand']) {
      const tile = screen.getByText(label).closest('[data-slot="stat-tile"]') as HTMLElement;
      expect(tile).toHaveAttribute('data-state', 'unavailable');
      expect(tile).toHaveTextContent('No data source yet');
      expect(tile.textContent).not.toMatch(/\d/);
    }
    expect(UNAVAILABLE).toContain('animalsOnHand');
  });

  it('the stat tiles lead to the screens behind them', async () => {
    await renderApp('/', await signedIn('owner'));
    const stock = await screen.findByRole('link', { name: /Stock value/ });
    expect(stock).toHaveAttribute('href', '/stock');
    expect(screen.getByRole('link', { name: /Purchases today/ })).toHaveAttribute(
      'href',
      '/goods-receipts',
    );
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
    expect(refusal).toHaveTextContent('Goat G-0163 is under a veterinary withdrawal period');
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
    ready: 'LIV-GOAT',
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
    expect((await screen.findAllByText(c.loading)).length).toBeGreaterThan(0);
    release();
    expect((await screen.findAllByText(c.ready)).length).toBeGreaterThan(0);
  });

  it('empty, error with its reference, and permission denied, in words', async () => {
    mock.noRows = true;
    await renderApp(c.path, await signedIn('owner'));
    expect((await screen.findAllByText(c.empty)).length).toBeGreaterThan(0);
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
