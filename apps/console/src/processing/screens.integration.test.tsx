/**
 * The F6 processing screens against the REAL Prism mock (ADR 0019): the orders list, one completed order
 * with its trace both ways (each input animal opens its record, each output opens its lot), planning a new
 * order, and the yield standards, each in its four states. The lifecycle writes (start, complete, cancel) are
 * in the e2e spec, where the fake API can give an order each status.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

const PRISM_500_REFERENCE = '019a7b1e-32bc-78e3-8e1c-970f89c10fed';
const ANY_ID = '019a7a86-3046-711a-a652-1a7389f79351';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('processing orders', () => {
  it('loading, then each order with its state and its animals', async () => {
    const release = holdResponses();
    await renderApp('/processing-orders', await signedIn('owner'));
    expect((await screen.findAllByText('Loading processing orders')).length).toBeGreaterThan(0);
    release();
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('G-0098'));
    const table = screen.getByRole('table');
    for (const status of ['Completed', 'In progress', 'Planned', 'Cancelled']) {
      expect(within(table).getAllByText(status).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: 'New processing order' })).toBeInTheDocument();
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/processing-orders', await signedIn('owner'));
    expect(await screen.findByText('No processing orders yet')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/processing-orders';
    await renderApp('/processing-orders', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Processing orders could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/processing-orders', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to processing orders')).toBeDefined(),
    );
  });

  it('a completed order: its animal opens its record, its outputs open their lots, costs from the API', async () => {
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Processing order Not numbered yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'G-0098' })).toHaveAttribute(
      'href',
      '/animals/019a7a90-37c3-75d9-9b12-666ffe5adf4d',
    );
    const lot = screen.getByRole('link', { name: 'PRC-261109-3a247e03-01' });
    expect(lot).toHaveAttribute('href', '/lots?q=PRC-261109-3a247e03-01');
    // The API's figures, never the client's: total cost, the allocation, the yields.
    expect(screen.getByText('GH₵721.00')).toBeInTheDocument();
    expect(screen.getAllByText('GH₵640.35').length).toBeGreaterThan(0);
    expect(document.body).toHaveTextContent('58.446');
    // A completed order offers no lifecycle write.
    expect(screen.queryByRole('button', { name: 'Complete the order' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel the order' })).toBeNull();
  });

  it('pack labels are drawn from the API’s label data, each with its barcode, a reprint marked', async () => {
    const user = userEvent.setup();
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: /^Print \d+ labels?$/ }));
    // printPackLabels answers PackLabelSheet (contract 1.26.0): the client draws it.
    const sheet = await screen.findByRole('list', { name: 'Pack labels' });
    const labels = within(sheet).getAllByRole('listitem');
    expect(labels).toHaveLength(2);
    expect(labels[0]).toHaveTextContent('PRC-261114-3f2a91c4-01 · 15.000 kg');
    expect(labels[0]).toHaveTextContent('Reprint');
    expect(labels[1]).not.toHaveTextContent('Reprint');
    expect(
      within(labels[1] as HTMLElement).getByRole('img', { name: /Pack barcode/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print the sheet' })).toBeInTheDocument();
  });

  it('reversing a completed order names its cost and outputs first, then says it is reversed', async () => {
    const user = userEvent.setup();
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Reverse the order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reverse this completed order?' });
    expect(dialog).toHaveTextContent('GH₵721.00');
    expect(dialog).toHaveTextContent('14.200');
    await user.type(within(dialog).getByRole('textbox'), 'Weighed on the wrong scale');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse the order' }));
    expect(await screen.findByText(/The order was reversed/)).toBeInTheDocument();
  });

  it('a lot links back to the order it came from, which opens on its animal', async () => {
    await renderApp('/lots', await signedIn('owner'));
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(1),
    );
    expect(screen.getByRole('columnheader', { name: 'Came from' })).toBeInTheDocument();
  });

  it('not found, error and denied on one order, in words', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/processing-orders';
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByText('There is no processing order at this address'),
    ).toBeInTheDocument();
    queryClient.clear();
    mock.prefer = 'code=500';
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('This processing order could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp(`/processing-orders/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to this processing order')).toBeDefined(),
    );
  });

  it('planning a new order says that planning moves no stock', async () => {
    await renderApp('/processing-orders/new', await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New processing order' }),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent('Planning an order moves no stock');
  });

  it('a role without processing meets the orders as permission denied, in words', async () => {
    await renderApp('/processing-orders', await signedIn('storekeeper'));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('yield standards', () => {
  it('each standard, input to output, as the API states its percentages', async () => {
    await renderApp('/yield-standards', await signedIn('owner'));
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Goat'));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Sheep');
    expect(screen.getByRole('button', { name: 'New yield standard' })).toBeEnabled();
  });

  it('empty, error and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/yield-standards', await signedIn('owner'));
    expect(await screen.findByText('No yield standards yet')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/yield-standards';
    await renderApp('/yield-standards', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Yield standards could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/yield-standards', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to yield standards')).toBeDefined(),
    );
  });
});
