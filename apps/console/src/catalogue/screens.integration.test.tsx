/**
 * Every F4 screen against the REAL Prism mock (ADR 0019), mounted through the app's own routes, shell and
 * providers, in its four states, as the F3 screens are: loading (a held answer), empty (a list with no rows
 * until CR-005, or the contract's 404 for a record), error (the contract's 500 and its reference) and
 * permission denied (the contract's 403 in words, with no retry). Then the gate's two writes: changing a
 * line of a draft, and submitting it, which the contract answers with 202 "nothing has taken effect".
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

/** Prism's 500 reference (`019a7b1e-…-970f89c10fed`) as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_500_REFERENCE = '89c1 0fed';
const ANY_ID = '019a7a86-3046-711a-a652-1a7389f79351';
/** The draft in the contract's `getPriceListVersion` example. */
const DRAFT_ID = '019a7aa3-e9f0-71af-86e7-23c27a0d9ca0';

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
    screen: 'products',
    path: '/products',
    ready: 'LIV-0004',
    loading: 'Loading products',
    empty: 'No products match',
    emptyBy: 'noRows',
    error: 'Products could not be loaded',
    denied: 'You do not have access to products',
  },
  {
    screen: 'product',
    path: `/products/${ANY_ID}`,
    ready: 'Stock-keeping facts',
    loading: 'Loading the product',
    empty: 'There is no product at this address',
    emptyBy: '404',
    error: 'This product could not be loaded',
    denied: 'You do not have access to this product',
  },
  {
    screen: 'new product',
    path: '/products/new',
    ready: 'Create product',
    loading: 'Loading categories, units and species',
    empty: 'There are no categories or units to choose from',
    emptyBy: 'noRows',
    error: 'Categories, units or species could not be loaded',
    denied: 'You cannot see the categories, units or species a product needs',
  },
  {
    screen: 'categories',
    path: '/categories',
    ready: 'Feed and medication',
    loading: 'Loading categories',
    empty: 'No categories yet',
    emptyBy: 'noRows',
    error: 'Categories could not be loaded',
    denied: 'You do not have access to categories',
  },
  {
    screen: 'units',
    path: '/units',
    ready: 'Kilogram',
    loading: 'Loading units',
    empty: 'No units',
    emptyBy: 'noRows',
    error: 'Units could not be loaded',
    denied: 'You do not have access to units',
  },
  {
    screen: 'species',
    path: '/species',
    ready: 'Local chicken',
    loading: 'Loading species',
    empty: 'No species yet',
    emptyBy: 'noRows',
    error: 'Species could not be loaded',
    denied: 'You do not have access to species',
  },
  {
    screen: 'species detail',
    path: `/species/${ANY_ID}`,
    ready: 'GOAT-M',
    loading: 'Loading the species',
    empty: 'There is no species at this address',
    emptyBy: '404',
    error: 'This species could not be loaded',
    denied: 'You do not have access to this species',
  },
  {
    screen: 'price lists',
    path: '/price-lists',
    ready: 'Royal Palm Hotel contract prices',
    loading: 'Loading price lists',
    empty: 'No price lists yet',
    emptyBy: 'noRows',
    error: 'Price lists could not be loaded',
    denied: 'You do not have access to price lists',
  },
  {
    screen: 'price list',
    path: `/price-lists/${ANY_ID}`,
    ready: 'Feed price rise passed through to broilers',
    loading: 'Loading the price list',
    empty: 'There is no price list at this address',
    emptyBy: '404',
    error: 'This price list could not be loaded',
    denied: 'You do not have access to this price list',
  },
  {
    screen: 'price list version',
    path: `/price-list-versions/${DRAFT_ID}`,
    ready: 'Preview before it takes effect',
    loading: 'Loading the price list version',
    empty: 'There is no price list version at this address',
    emptyBy: '404',
    error: 'This price list version could not be loaded',
    denied: 'You do not have access to this price list',
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

describe('the F4 gate: a draft is previewed, changed and submitted before anything activates', () => {
  it('shows every line of the draft with its price now and from the draft, and the counts', async () => {
    await renderApp(`/price-list-versions/${DRAFT_ID}`, await signedIn('owner'));
    const table = await screen.findByRole('region', {
      name: 'Preview of the draft against the prices in force',
    });
    expect(within(table).getAllByText('Goat').length).toBeGreaterThan(0);
    expect(within(table).getByText('Beef, 15 kg pack')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'What changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
  });

  it('changing a line sends the whole draft back and says it was saved', async () => {
    const user = userEvent.setup();
    await renderApp(`/price-list-versions/${DRAFT_ID}`, await signedIn('owner'));
    await user.click(
      await screen.findByRole('button', { name: 'Change the prices of Beef, 15 kg pack' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Prices of Beef, 15 kg pack' });
    const list = within(dialog).getByLabelText(/^list price, GHS per kg/i);
    await user.clear(list);
    await user.type(list, '32.50');
    await user.click(within(dialog).getByRole('button', { name: 'Save prices' }));
    expect(
      await screen.findByText('Prices of Beef, 15 kg pack saved in the draft'),
    ).toBeInTheDocument();
  });

  it('submitting asks first, and a 202 says nothing has changed yet, in words that stay', async () => {
    const user = userEvent.setup();
    mock.prefer = 'code=202';
    mock.preferPath = `/price-list-versions/${DRAFT_ID}/submit`;
    await renderApp(`/price-list-versions/${DRAFT_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this draft for approval?' });
    expect(dialog).toHaveTextContent('Takes effect from 2026-12-01 00:00');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent for approval. Nothing has changed yet',
    );
  });

  it('a refused submit stays in the dialog with its reference', async () => {
    const user = userEvent.setup();
    mock.prefer = 'code=500';
    mock.preferPath = `/price-list-versions/${DRAFT_ID}/submit`;
    await renderApp(`/price-list-versions/${DRAFT_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this draft for approval?' });
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(PRISM_500_REFERENCE);
  });
});
