/**
 * The approvals inbox and one request against the REAL Prism mock (ADR 0019), in their four states. The
 * maker's own request and the server's MAKER_CANNOT_CHECK are in the e2e spec, where the fake API can
 * make the signed-in user the requester.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('the approvals inbox', () => {
  it('loading, then each request with its kind, amount, who asked and its state', async () => {
    const release = holdResponses();
    await renderApp('/approvals', await signedIn('owner'));
    // The first screen of a file is cold (its lazy chunk and words load first): F5b's 5 s allowance.
    expect(
      (await screen.findAllByText('Loading approval requests', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Void a sale'));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('GH₵1,275.00');
    expect(table).toHaveTextContent('Adwoa Darko');
    expect(within(table).getAllByText('Waiting').length).toBeGreaterThan(0);
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/approvals', await signedIn('owner'));
    expect(await screen.findByText('Nothing is waiting on you')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/iam/approvals';
    await renderApp('/approvals', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Approval requests could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/approvals', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to approval requests')).toBeDefined(),
    );
  });
});

describe('one request', () => {
  it('shows its evidence, and approving it names the amount first', async () => {
    const user = userEvent.setup();
    await renderApp(`/approvals/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Void a sale' }),
    ).toBeInTheDocument();
    const evidence = screen.getByRole('region', { name: 'Evidence' });
    expect(evidence).toHaveTextContent('GH₵1,275.00');
    expect(evidence).toHaveTextContent('Adwoa Darko');
    expect(screen.getByText('No photograph is attached.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this Void a sale?' });
    expect(dialog).toHaveTextContent('GH₵1,275.00');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved. It has taken effect.')).toBeInTheDocument();
  });

  it('not found, error and denied, in words', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/iam/approvals/';
    await renderApp(`/approvals/${ANY_ID}`, await signedIn('owner'));
    expect(await screen.findByText('This request was not found')).toBeInTheDocument();
    queryClient.clear();
    mock.prefer = 'code=500';
    await renderApp(`/approvals/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('The request could not be loaded')).toHaveTextContent(PRISM_500_REFERENCE),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp(`/approvals/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() => expect(alertWith('You do not have access to this request')).toBeDefined());
  });
});
