/**
 * Quotes, requests for quote, an order's credit check, wholesale accounts and the ageing against the REAL
 * Prism mock (ADR 0019), in their four states, with every contract-request switch off, as a deployed build
 * runs. Building, revising, sending and converting a quote, the credit refusal and its override are in
 * `e2e/specs/console/quotes-credit.spec.ts`, where the fake API holds the quote's state.
 */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

/** Prism's 500 reference as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_500_REFERENCE = '89c1 0fed';
const ANY_ID = '019a7a98-3161-727e-b7b7-30bd5dfca99b';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('quotes', () => {
  it("loading, then each quote with its state and the API's total", async () => {
    const release = holdResponses();
    await renderApp('/quotes', await signedIn('owner'));
    expect(
      (await screen.findAllByText('Loading quotes', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('QUO-2026-DDW-000088'));
    expect(screen.getByRole('table')).toHaveTextContent('GH₵17,172.00');
    expect(screen.getByRole('table')).toHaveTextContent('Sent to the customer');
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/quotes', await signedIn('owner'));
    expect(await screen.findByText('No quotes yet', {}, { timeout: 5000 })).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/quotes';
    await renderApp('/quotes', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('The quotes could not be loaded')).toHaveTextContent(PRISM_500_REFERENCE),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/quotes', await signedIn('owner'));
    await waitFor(() => expect(alertWith('You cannot see quotes')).toBeDefined());
  });

  it('one quote: its version in force, every version listed, and what it can do next', async () => {
    await renderApp(`/quotes/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'QUO-2026-DDW-000088' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Versions' })).toBeVisible());
    expect(screen.getByRole('button', { name: 'Revise' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Record an acceptance' })).toBeVisible();
  });

  it('markup over cost and margin over the selling price, as 2.29.0 names them', async () => {
    await renderApp(`/quotes/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'QUO-2026-DDW-000088' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    // The contract's example: 43.94 percent markup over cost, 30.77 percent margin over the price.
    const markup = screen.getByText('Markup over cost');
    expect(markup.nextElementSibling).toHaveTextContent('43.94 percent');
    const margin = screen.getByText('Margin over the selling price');
    expect(margin.nextElementSibling).toHaveTextContent('30.77 percent');
  });

  it('a new quote is built from the contract, with no notice that a unit waits (CR-045, 2.12.0)', async () => {
    await renderApp('/quotes/new', await signedIn('owner'));
    expect(await screen.findByRole('heading', { name: 'Lines' }, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByText(/single egg wait/)).toBeNull();
  });
});

describe('requests for quote', () => {
  it('the list and one request, from the contract', async () => {
    await renderApp('/rfqs', await signedIn('owner'));
    await waitFor(
      () => expect(screen.getByRole('table')).toHaveTextContent('RFQ-2026-DDW-000154'),
      { timeout: 5000 },
    );
    queryClient.clear();
    await renderApp(`/rfqs/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'What they asked for' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});

describe('an order', () => {
  it('reads the order, with no credit check asked for when the switch is off', async () => {
    await renderApp(`/orders/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'SO-2026-DDW-004211' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: "The order's lines" })).toBeVisible();
  });
});

describe('wholesale accounts and the ageing', () => {
  it("the list, one account with how late it is, and the ageing's totals", async () => {
    await renderApp('/business-accounts', await signedIn('owner'));
    await waitFor(
      () => expect(screen.getByRole('table')).toHaveTextContent('Royal Palm Hotel Ltd'),
      { timeout: 5000 },
    );
    expect(screen.getByRole('table')).toHaveTextContent('GH₵20,000.00');
    queryClient.clear();
    await renderApp(`/business-accounts/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'Royal Palm Hotel Ltd' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'How late' })).toBeVisible());
    expect(screen.getByRole('heading', { name: 'Credit overrides' })).toBeVisible();
    queryClient.clear();
    await renderApp('/ageing', await signedIn('owner'));
    await waitFor(
      () =>
        expect(screen.getAllByRole('region', { name: 'Ageing' })[0]).toHaveTextContent(
          'GH₵5,229.00',
        ),
      { timeout: 5000 },
    );
    expect(screen.getAllByText('As the server worked it out on 2026-11-13').length).toBeGreaterThan(
      0,
    );
  });

  it('the ageing is denied in words', async () => {
    mock.prefer = 'code=403';
    mock.preferPath = '/receivables/ageing';
    await renderApp('/ageing', await signedIn('owner'));
    await waitFor(() => expect(alertWith('You cannot see the ageing')).toBeDefined(), {
      timeout: 5000,
    });
  });
});
