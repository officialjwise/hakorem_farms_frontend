/**
 * Payment reminders (dunning, 2.16.0) against the REAL Prism mock (ADR 0019): the reminder levels, the
 * reminders sent and a buyer's reminders on their account, in their four states. A refusal with its reason
 * and the bodies sent are in `e2e/specs/console/dunning.spec.ts`, where the fake API answers them.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const levelsTable = () =>
  screen.findByRole('region', { name: 'The reminder levels, lowest first' });

describe('the reminder levels', () => {
  it("loading, then each level as the API answers it, and a Manager's way to change them", async () => {
    const release = holdResponses();
    await renderApp('/dunning-policy', await signedIn('manager'));
    expect(
      (await screen.findAllByText('Loading the reminder levels', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    const table = await levelsTable();
    expect(table).toHaveTextContent('Level 1');
    expect(table).toHaveTextContent('7 days overdue');
    expect(table).toHaveTextContent('Level 5');
    expect(table).toHaveTextContent('60 days overdue');
    expect(table).toHaveTextContent('SMS, Email');
    expect(table).toHaveTextContent('PAYMENT_REMINDER_3');
    expect(screen.getByRole('button', { name: 'Change the levels' })).toBeVisible();
  });

  it('empty says reminders are off, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/dunning-policy', await signedIn('manager'));
    expect(
      await screen.findByText('Payment reminders are off', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set the levels' })).toBeVisible();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/dunning-policy';
    await renderApp('/dunning-policy', await signedIn('manager'));
    await waitFor(
      () =>
        expect(alertWith('The reminder levels could not be loaded')).toHaveTextContent(
          PRISM_500_REFERENCE,
        ),
      { timeout: 5000 },
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/dunning-policy', await signedIn('manager'));
    await waitFor(() => expect(alertWith('You cannot see the reminder levels')).toBeDefined(), {
      timeout: 5000,
    });
  });

  it('Sales reads the levels and is offered no change', async () => {
    await renderApp('/dunning-policy', await signedIn('sales'));
    expect(await levelsTable()).toHaveTextContent('Level 5');
    expect(screen.getByText(/An Owner or Manager changes the levels/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change the levels' })).toBeNull();
  });

  it('removing every level says reminders turn off before saving, and asks to confirm', async () => {
    const user = userEvent.setup();
    await renderApp('/dunning-policy', await signedIn('manager'));
    await levelsTable();
    await user.click(screen.getByRole('button', { name: 'Change the levels' }));
    const form = screen.getByRole('form', { name: 'Change the reminder levels' });
    for (const number of [5, 4, 3, 2, 1]) {
      await user.click(within(form).getByRole('button', { name: `Remove level ${number}` }));
    }
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'With no levels, payment reminders are off',
    );
    await user.click(within(form).getByRole('button', { name: 'Save the levels' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn payment reminders off?' });
    await user.click(within(dialog).getByRole('button', { name: 'Turn reminders off' }));
    // Prism keeps no state: it answers the contract's example, three levels.
    expect(
      await screen.findByText('The reminder levels were saved', {}, { timeout: 5000 }),
    ).toBeVisible();
  });

  it('a new level is checked in words before anything is sent', async () => {
    const user = userEvent.setup();
    await renderApp('/dunning-policy', await signedIn('manager'));
    await levelsTable();
    await user.click(screen.getByRole('button', { name: 'Change the levels' }));
    const form = screen.getByRole('form', { name: 'Change the reminder levels' });
    await user.click(within(form).getByRole('button', { name: 'Add a level' }));
    mock.requests = [];
    await user.click(within(form).getByRole('button', { name: 'Save the levels' }));
    expect(within(form).getByText('Type a whole number of days from 1 to 365.')).toBeVisible();
    expect(within(form).getByText('Choose the first channel.')).toBeVisible();
    expect(within(form).getByText('Type the template code.')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock.requests.filter((url) => url.pathname.endsWith('/dunning-policy'))).toEqual([]);
  });

  it('a refused save stays on the form, in words, after the confirmation closes', async () => {
    const user = userEvent.setup();
    await renderApp('/dunning-policy', await signedIn('manager'));
    await levelsTable();
    await user.click(screen.getByRole('button', { name: 'Change the levels' }));
    const form = screen.getByRole('form', { name: 'Change the reminder levels' });
    await user.click(within(form).getByRole('button', { name: 'Save the levels' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save these reminder levels?' });
    expect(dialog).toHaveTextContent(
      'Level 5: 60 days overdue, by SMS, Email, template PAYMENT_REMINDER_5',
    );
    mock.prefer = 'code=422';
    mock.preferPath = '/dunning-policy';
    await user.click(within(dialog).getByRole('button', { name: 'Save the levels' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 5000 });
    expect(alertWith('The reminder levels were not saved')).toBeDefined();
  });
});

describe('the reminders sent', () => {
  it('loading, then each reminder newest first with its amount, and denied in words', async () => {
    const release = holdResponses();
    await renderApp('/dunning-notices', await signedIn('sales'));
    expect(
      (await screen.findAllByText('Loading the reminders sent', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    // The page and its table are both named "Reminders sent": the table is the last.
    const tableRegion = () => screen.getAllByRole('region', { name: 'Reminders sent' }).at(-1);
    await waitFor(() => expect(tableRegion()).toHaveTextContent('Royal Palm Hotel Ltd'));
    const table = tableRegion();
    expect(table).toHaveTextContent('INV-2026-DDW-001150');
    expect(table).toHaveTextContent('Level 2');
    expect(table).toHaveTextContent('GH₵2,225.00');
    expect(table).toHaveTextContent('SMS, Email');
    expect(table).toHaveTextContent('2026-11-13');
    queryClient.clear();
    mock.prefer = 'code=403';
    mock.preferPath = '/dunning-notices';
    await renderApp('/dunning-notices', await signedIn('sales'));
    await waitFor(() => expect(alertWith('You cannot see the reminders sent')).toBeDefined(), {
      timeout: 5000,
    });
  });

  it('empty and error, in words', async () => {
    mock.noRows = true;
    await renderApp('/dunning-notices', await signedIn('manager'));
    expect(
      await screen.findByText('No payment reminder has been sent', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/dunning-notices';
    await renderApp('/dunning-notices', await signedIn('manager'));
    await waitFor(
      () =>
        expect(alertWith('The reminders sent could not be loaded')).toHaveTextContent(
          PRISM_500_REFERENCE,
        ),
      { timeout: 5000 },
    );
  });

  it("a buyer's account shows that buyer's reminders, asked for by customer", async () => {
    await renderApp(`/business-accounts/${ANY_ID}`, await signedIn('sales'));
    const reminders = () =>
      screen.getByRole('region', {
        name: 'Each payment reminder sent to this buyer, newest first',
      });
    await waitFor(() => expect(reminders()).toHaveTextContent('INV-2026-DDW-001159'), {
      timeout: 5000,
    });
    expect(reminders()).toHaveTextContent('GH₵1,860.00');
    expect(screen.getByRole('heading', { name: 'Payment reminders' })).toBeVisible();
    const asked = mock.requests.filter((url) => url.pathname.endsWith('/dunning-notices'));
    // Asked for the account's own customer (the contract's example account), never for everyone.
    expect(asked.length).toBeGreaterThan(0);
    for (const url of asked) expect(url.searchParams.get('customerId')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
