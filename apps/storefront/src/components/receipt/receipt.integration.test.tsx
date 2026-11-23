import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReceiptByLinkPage from '../../app/r/[token]/page';
import { mock } from '../../test-integration-setup';
import { Root } from '../../test-wrapper';

const TOKEN = 'Rc7vN2kXc9TfL4mWb8RyQ1';
const page = async (token = TOKEN) =>
  render(await ReceiptByLinkPage({ params: Promise.resolve({ token }) }), { wrapper: Root });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a receipt by its link, against the real Prism', () => {
  it('shows the business, both numbers, the time in Accra, the lines, the total, the tenders and the change', async () => {
    await page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your receipt');
    const business = screen.getByText('HaKorem Farms').closest('address');
    expect(business).toHaveTextContent('Example Road, Dodowa');
    expect(within(business as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      'tel:+233200000000',
    );
    expect(screen.getByText('RCP-2026-DDW-T2-006101')).toBeInTheDocument();
    expect(screen.getByText('SO-2026-DDW-004207')).toBeInTheDocument();
    expect(screen.getByText('2026-11-13 09:40 (Accra time)')).toHaveAttribute(
      'datetime',
      '2026-11-13T09:40:12Z',
    );
    const line = within(screen.getByRole('region', { name: 'What you bought' })).getByRole(
      'listitem',
    );
    expect(line).toHaveTextContent('Eggs, large');
    expect(line).toHaveTextContent('2 crates');
    expect(line).toHaveTextContent('GH₵60.00');
    expect(line).toHaveTextContent('GH₵120.00');
    expect(line).not.toHaveTextContent('Weight');
    const payment = screen.getByRole('region', { name: 'Total and payment' });
    expect(payment).toHaveTextContent(
      'TotalGH₵120.00CashGH₵120.00Handed overGH₵150.00ChangeGH₵30.00',
    );
    expect(payment).toHaveTextContent('This link works until 2027-11-13 09:40 (Accra time).');
  });

  it('a link the server does not know is the one 404 in words, with how to reach the shop', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/shop/receipts/';
    await page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'We cannot find this receipt',
    );
    expect(screen.getByText(/may not have reached the farm yet/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Ask the shop' })).getByRole('link', {
        name: 'Call 020 000 0120',
      }),
    ).toHaveAttribute('href', 'tel:+233200000120');
    expect(screen.queryByText(/RCP-|GH₵/)).toBeNull();
  });

  it('a token without the till’s shape is the same 404, and no receipt is asked for', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await page('not-a-token');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'We cannot find this receipt',
    );
    const asked = fetch.mock.calls.map(([input]) =>
      input instanceof Request ? input.url : String(input),
    );
    expect(asked.some((url) => url.includes('/shop/receipts/'))).toBe(false);
  });

  it('a failure says so, with the reference and a retry to the same address', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/shop/receipts/';
    await page();
    expect(screen.getByText('The receipt could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/quote this reference/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', `/r/${TOKEN}`);
  });
});
