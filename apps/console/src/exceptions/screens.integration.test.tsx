/**
 * The daily exception report against the REAL Prism mock (ADR 0019): the contract's example day, urgent
 * first, each item with its branch, who, when, amount and record, its review (CR-059, 2.48.0) and the count
 * lines (2.52.0); then error and denied. The empty day and marking an item reviewed are in the e2e spec,
 * where the fake API can answer them.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

const PRISM_500_REFERENCE = '89c1 0fed';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('the daily exception report', () => {
  it('loading, then every item urgent first with who, when, amount and the record behind it', async () => {
    const release = holdResponses();
    await renderApp('/exceptions', await signedIn('owner'));
    expect(
      (await screen.findAllByText('Loading the exception report', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    const list = await screen.findByRole('list', { name: 'Exceptions, urgent first' });
    const cards = within(list).getAllByRole('listitem');
    // The example has two URGENT items (a stock conflict, a driver short), then REVIEW, then INFO last.
    expect(cards[0]).toHaveTextContent('Urgent');
    expect(cards[1]).toHaveTextContent('Urgent');
    expect(cards.at(-1)).toHaveTextContent('For information');
    expect(cards.at(-1)).toHaveTextContent('Price different from the list');
    const shortCard = cards.find((card) => card.textContent?.includes('Kwesi Appiah'));
    expect(shortCard).toHaveTextContent('Kwesi Appiah handed in GHS 1,440.00 of GHS 1,540.00');
    expect(shortCard).toHaveTextContent('GH₵100.00');
    // A sale's void links to the order; a driver's hand-in has no screen yet and says so.
    const voidCard = cards.find((card) => card.textContent?.includes('Sale voided'));
    expect(
      within(voidCard as HTMLElement).getByRole('link', { name: 'Open the sale' }),
    ).toHaveAttribute('href', '/orders/019a7b12-5b3e-7fd0-a508-05d2f3ff7eb0');
    expect(shortCard).toHaveTextContent('which has no screen in the back office yet');
    // The example's void is reviewed, with who and the note; every other item can be marked reviewed.
    expect(voidCard).toHaveTextContent('Reviewed by Kwabena Owusu');
    expect(
      within(voidCard as HTMLElement).queryByRole('button', { name: /Mark reviewed/ }),
    ).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Mark reviewed/ })).toHaveLength(
      cards.length - 1,
    );
    // The till sales that sent no receipt token are counted, not listed (2.52.0).
    expect(screen.getByRole('region', { name: 'Counted controls by branch' })).toHaveTextContent(
      '5 till sales sent no receipt token',
    );
    // What each control raised, and who did what how often, are the API's own figures.
    expect(screen.getByRole('region', { name: 'Exceptions by control' })).toHaveTextContent(
      'GH₵1,275.00',
    );
    expect(screen.getByRole('region', { name: 'Voids by cashier' })).toHaveTextContent('2.63%');
    expect(screen.getByRole('region', { name: 'Who approved whom' })).toHaveTextContent(
      'Kwabena Owusu',
    );
  });

  it('error with its reference, and denied, in words', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/exceptions';
    await renderApp('/exceptions', await signedIn('owner'));
    await waitFor(
      () =>
        expect(alertWith('The exception report could not be loaded')).toHaveTextContent(
          PRISM_500_REFERENCE,
        ),
      { timeout: 5000 },
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/exceptions', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to the exception report')).toBeDefined(),
    );
  });
});
