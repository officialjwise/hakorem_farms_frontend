/**
 * Supplier invoices, payments and a supplier's account against the REAL Prism mock (ADR 0019), in their
 * four states, with every contract-request switch off, as a deployed build runs. Entering, matching,
 * approving and paying, with the maker refused, are in `e2e/specs/console/supplier-invoices.spec.ts`,
 * where the fake API holds the egg order's state.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

/** Prism's 500 reference (`019a7b1e-…-970f89c10fed`) as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_500_REFERENCE = '89c1 0fed';
const ANY_ID = '019a7a98-3161-727e-b7b7-30bd5dfca99b';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('supplier invoices', () => {
  it("loading, then each invoice with its match and what is still owed, from the contract's example", async () => {
    const release = holdResponses();
    await renderApp('/supplier-invoices', await signedIn('owner'));
    // The first screen of a file is cold (its lazy chunk and words load first): F5b's 5 s allowance.
    expect(
      (await screen.findAllByText('Loading supplier invoices', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Invoice 88120'));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('GH₵10,400.00');
    expect(within(table).getAllByText('Does not match').length).toBeGreaterThan(0);
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/supplier-invoices', await signedIn('owner'));
    expect(await screen.findByText('No supplier invoices')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/supplier-invoices';
    await renderApp('/supplier-invoices', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('The supplier invoices could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/supplier-invoices', await signedIn('owner'));
    await waitFor(() => expect(alertWith('You cannot see supplier invoices')).toBeDefined());
  });

  it("one invoice shows the contract's match, its totals and what is paid", async () => {
    await renderApp(`/supplier-invoices/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { name: 'Invoice 88120' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Every line matches the order and what was received')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Invoice lines' })).toHaveTextContent(
      'Broiler finisher feed',
    );
  });
});

describe('supplier payments', () => {
  it("the list, from the contract's example", async () => {
    await renderApp('/supplier-payments', await signedIn('owner'));
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Ashanti Feeds Ltd'), {
      timeout: 5000,
    });
  });
});

describe("a supplier's account", () => {
  it('says the balance waits for the server, and lists its invoices, claims and payments', async () => {
    await renderApp(`/suppliers/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByText('The balance waits for the server', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    // Switch off (CR-042): nothing is asked for the balance, and nothing on screen adds the rows up.
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Invoices still owed' })).toHaveTextContent(
        'Invoice',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Open claims' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
  });
});
