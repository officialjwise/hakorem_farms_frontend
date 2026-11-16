/**
 * The F8 billing screens against the REAL Prism mock (ADR 0019): the documents list in its four states, one
 * document with its tax breakdown to the pesewa, its archive and its reprint history, a credit note sent for
 * approval, and the statements. A PDF reprint, which the contract's example answers as a till-printer copy,
 * is in the e2e spec, where the fake API can give the answer a PDF.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney } from '@hakorem/ui';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

const PRISM_500_REFERENCE = '019a7b1e-32bc-78e3-8e1c-970f89c10fed';
const ANY_ID = '019a7ae2-fd46-7b80-a0b9-c0e09cf739be';

afterEach(() => {
  queryClient.clear();
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('invoices and receipts', () => {
  it('loading, then each document with its kind, total and payment state', async () => {
    const release = holdResponses();
    await renderApp('/billing-documents', await signedIn('owner'));
    expect(
      (await screen.findAllByText('Loading billing documents', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    await waitFor(() =>
      expect(screen.getByRole('table')).toHaveTextContent('Receipt RCP-2026-DDW-T1-018834'),
    );
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Invoice INV-2026-DDW-001198');
    expect(table).toHaveTextContent('Credit note CRN-2026-DDW-000086');
    expect(table).toHaveTextContent('Proforma invoice PRF-2026-DDW-000019');
    expect(table).toHaveTextContent(formatMoney(282694));
    expect(within(table).getAllByText('Unpaid').length).toBeGreaterThan(0);
    // The page's own link, beside the sidebar's.
    expect(
      screen
        .getAllByRole('link', { name: 'Customer statements' })
        .every((link) => link.getAttribute('href') === '/statements'),
    ).toBe(true);
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/billing-documents', await signedIn('owner'));
    expect(await screen.findByText('No billing documents yet')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/billing-documents';
    await renderApp('/billing-documents', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Billing documents could not be loaded')).toHaveTextContent(
        PRISM_500_REFERENCE,
      ),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/billing-documents', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to invoices and receipts')).toBeDefined(),
    );
  });

  it('a wrong-role user sees permission denied, not a broken page', async () => {
    await renderApp('/billing-documents', await signedIn('storekeeper'));
    expect((await screen.findAllByText(/do not have access|permission/i)).length).toBeGreaterThan(
      0,
    );
  });
});

describe('one document', () => {
  it('shows the tax breakdown exactly as the API issued it, to the pesewa', async () => {
    await renderApp(`/billing-documents/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Receipt RCP-2026-DDW-T1-018834' }),
    ).toBeInTheDocument();
    const breakdown = screen.getByRole('region', { name: 'Tax breakdown' });
    // The example's levy totals and totals, none added up here: VAT 57.38, NHIL 9.56, GETFund 9.56.
    for (const [term, pesewas] of [
      ['Value Added Tax (VAT)', 5738],
      ['National Health Insurance Levy (NHIL)', 956],
      ['GETFund Levy (GETFUND)', 956],
      ['Net', 130250],
      ['Tax and levies', 7650],
      ['Total', 137900],
    ] as const) {
      const dt = within(breakdown).getByText(term, { selector: 'dt' });
      expect(dt.nextElementSibling).toHaveTextContent(formatMoney(pesewas));
    }
    // Each line's levy rows, zero-rated ones included.
    expect(within(breakdown).getByLabelText("Each line's tax and levies")).toHaveTextContent(
      'Zero rated',
    );
    expect(
      screen.getByText('4f2ac1d27b94f03a6c58e2b17d40f9a3c6e1b2d5f8a7c4e9b0d3f6a1c2e5b8d7'),
    ).toBeInTheDocument();
    expect(screen.getByText('Reprinted once')).toBeInTheDocument();
    expect(await screen.findByText('Reprint 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprint as PDF' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Raise a credit note' })).toHaveAttribute(
      'href',
      `/billing-documents/${ANY_ID}/credit-note`,
    );
  });

  it('opens the archived original through a signed link, and says viewing is not a copy', async () => {
    const user = userEvent.setup();
    await renderApp(`/billing-documents/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Open the archived original' }));
    expect(await screen.findByRole('link', { name: 'Open the PDF' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://files.hakoremfarms.com/private/'),
    );
    expect(
      screen.getByText(/Viewing the original is not a copy for a customer/),
    ).toBeInTheDocument();
  });

  it('a cashier can reprint but not credit, and is told the archive needs another permission', async () => {
    await renderApp(`/billing-documents/${ANY_ID}`, await signedIn('cashier'));
    expect(await screen.findByRole('button', { name: 'Reprint as PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Raise a credit note' })).toBeNull();
    expect(screen.getByText(/needs the document archive permission/)).toBeInTheDocument();
  });

  it('a credit note is sent for approval and says nothing has been posted', async () => {
    const user = userEvent.setup();
    await renderApp(`/billing-documents/${ANY_ID}/credit-note`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Credit note against Receipt RCP-2026-DDW-T1-018834',
      }),
    ).toBeInTheDocument();
    // Nothing chosen: the form says what is missing, in words.
    await user.click(screen.getByRole('button', { name: 'Review the credit note' }));
    expect(await screen.findByText('Choose at least one line to credit.')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /^reason/i }));
    await user.click(await screen.findByRole('option', { name: 'Damaged in delivery' }));
    await user.type(screen.getByRole('textbox', { name: /^note/i }), 'Two crates broken');
    await user.click(screen.getByRole('combobox', { name: 'Credit line 2 by' }));
    await user.click(await screen.findByRole('option', { name: 'Quantity' }));
    await user.type(screen.getByRole('textbox', { name: /^quantity to credit on line 2/i }), '1');
    await user.click(screen.getByRole('button', { name: 'Review the credit note' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Send this credit note for approval?',
    });
    expect(dialog).toHaveTextContent('Line 2, Eggs, big, crate of 30:');
    // Raised on its own, a credit note always waits for a second person: the contract's 202.
    mock.prefer = 'code=202';
    mock.preferPath = `/billing-documents/${ANY_ID}/credit-notes`;
    await user.click(within(dialog).getByRole('button', { name: 'Send for approval' }));
    expect(await screen.findByText('The credit note waits for approval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the request' })).toHaveAttribute(
      'href',
      '/approvals/019a7ae6-218c-7c9b-81d3-d282f8f14b60',
    );
  });
});

describe('customer statements', () => {
  it('the list, then one statement with its movements and balances from the API', async () => {
    await renderApp('/statements', await signedIn('owner'));
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('STM-2026-DDW-000031'));
    expect(screen.getByRole('table')).toHaveTextContent('Royal Palm Hotel Ltd');
    queryClient.clear();
    await renderApp('/statements/019a7b05-ca26-7b67-a09f-bf4984173827', await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Statement STM-2026-DDW-000031' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("The statement's movements")).toHaveTextContent(
      'Balance brought forward',
    );
    expect(screen.getAllByText(formatMoney(1165200)).length).toBeGreaterThan(0);
  });
});
