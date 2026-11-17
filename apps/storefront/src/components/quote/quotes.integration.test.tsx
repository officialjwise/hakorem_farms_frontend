import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuoteByLinkPage from '../../app/q/[token]/page';
import { getWords } from '../../i18n/server';
import { mock } from '../../test-integration-setup';
import { Root } from '../../test-wrapper';
import { QuoteRequestForm } from './QuoteRequestForm';

// The app router is not mounted in jsdom; a refusal asks it to read the page again, which is a no-op here.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const TOKEN = 'Zq7vN2kXc9TfL4mWb8RyH1sDj6PaGe3UoQiV5nBxKtE';
const page = async () =>
  render(await QuoteByLinkPage({ params: Promise.resolve({ token: TOKEN }) }), { wrapper: Root });

describe('a quote by its link, against the real Prism', () => {
  it('shows the API’s lines and totals and accepts after a confirmation, with the server’s answer kept', async () => {
    const user = userEvent.setup();
    await page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Quote QUO-2026-DDW-000088',
    );
    expect(screen.getByText('Waiting for your answer')).toBeInTheDocument();
    const line = screen.getByRole('listitem');
    expect(line).toHaveTextContent('Goats, 22 to 28 kg, West African Dwarf, for funeral');
    expect(line).toHaveTextContent('18 head');
    expect(line).toHaveTextContent('GH₵950.00 a head');
    expect(line).toHaveTextContent('GH₵17,100.00');
    expect(screen.getByText('GH₵17,172.00')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /Your full name/ }), 'Emmanuel Tetteh');
    await user.click(screen.getByRole('button', { name: 'Accept this quote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept quote QUO-2026-DDW-000088?' });
    expect(dialog).toHaveTextContent('version 2 for a total of GH₵17,172.00, as Emmanuel Tetteh');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, accept the quote' }));
    expect(
      await screen.findByText('Thank you. We will call you to arrange the deposit and delivery.'),
    ).toBeInTheDocument();
  });

  it('a link the server does not know says only that it is not valid', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/shop/quotes/';
    await page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This link is not valid');
    expect(screen.queryByText(/QUO-/)).toBeNull();
  });

  it('a refused acceptance stays on the page in words', async () => {
    const user = userEvent.setup();
    await page();
    mock.prefer = 'code=409';
    mock.preferPath = '/shop/quotes/';
    await user.type(screen.getByRole('textbox', { name: /Your full name/ }), 'Emmanuel Tetteh');
    await user.click(screen.getByRole('button', { name: 'Accept this quote' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, accept the quote' }));
    expect(await screen.findByText('The quote could not be answered')).toBeInTheDocument();
  });
});

describe('asking for a quote, against the real Prism', () => {
  async function fill() {
    const user = userEvent.setup();
    const words = await getWords('quoteRequest', 'refusals', 'cart');
    render(<QuoteRequestForm words={words} />, { wrapper: Root });
    await user.type(screen.getByRole('textbox', { name: /Your name/ }), 'Akosua Bakery');
    await user.type(screen.getByRole('textbox', { name: /Phone number/ }), '024 451 2876');
    await user.type(screen.getByRole('textbox', { name: /What you want/ }), 'Big eggs on Fridays');
    await user.type(screen.getByRole('textbox', { name: /How many crates/ }), '40');
    await user.click(screen.getByRole('checkbox', { name: /You may call/ }));
    return user;
  }

  it('sends the request and shows the server’s number and message', async () => {
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Send my request' }));
    expect(
      await screen.findByRole('heading', { name: 'Request RFQ-2026-DDW-000154 is with us' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Thank you. Kojo from our sales team will call you within one working day.'),
    ).toBeInTheDocument();
  });

  it('a refusal stays on the form in words, with what was typed kept', async () => {
    // A 429 is retried twice by the data layer after the server's Retry-After (ADR 0022), so its words are
    // proved in the e2e spec, whose answer carries none; here a 422 refusal.
    const user = await fill();
    mock.prefer = 'code=422';
    mock.preferPath = '/shop/quote-requests';
    await user.click(screen.getByRole('button', { name: 'Send my request' }));
    expect(await screen.findByText('Your request was not sent')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /What you want/ })).toHaveValue(
      'Big eggs on Fridays',
    );
  });
});
