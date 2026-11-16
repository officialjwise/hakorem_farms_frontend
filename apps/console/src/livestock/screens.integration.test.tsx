/**
 * The F6 livestock screens against the REAL Prism mock (ADR 0019), through the app's own routes and shell:
 * the register, one animal's whole history on one screen (the F6 gate), the records behind it (weights,
 * health, breeding, deaths and culls, feed) in their four states, the writes that need a confirmation, and
 * what the Farm hand (A-158) sees.
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

describe('the animal register', () => {
  it('loading, then every animal with its pen, last weight and cost, each opening its page', async () => {
    const release = holdResponses();
    await renderApp('/animals', await signedIn('owner'));
    // The first screen of a file is cold (its lazy chunk and words load first): F5b's 5 s allowance.
    expect(
      (await screen.findAllByText('Loading animals', {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    release();
    const goat = await screen.findByRole('link', { name: 'Open G-0142, Goat' });
    expect(goat).toHaveAttribute('href', `/animals/019a7a8f-5f3a-70a1-a5d9-12ebaa838bc9`);
    const row = goat.closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Goat pen 1');
    expect(row).toHaveTextContent('26.400');
    expect(row).toHaveTextContent('612.50');
    expect(within(row).getByText('Alive')).toBeInTheDocument();
  });

  it('empty, error with its reference, and denied, in words', async () => {
    mock.noRows = true;
    await renderApp('/animals', await signedIn('owner'));
    expect(await screen.findByText('No animals here')).toBeInTheDocument();
    queryClient.clear();
    mock.noRows = false;
    mock.prefer = 'code=500';
    mock.preferPath = '/animals';
    await renderApp('/animals', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('Animals could not be loaded')).toHaveTextContent(PRISM_500_REFERENCE),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp('/animals', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to the animal register')).toBeDefined(),
    );
  });
});

describe('one animal: the F6 gate', () => {
  it('reads its whole history on one screen, newest first, after four facts that matter at the pen', async () => {
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'G-0142, Goat' }),
    ).toBeInTheDocument();
    const facts = screen.getByLabelText('At a glance');
    expect(facts).toHaveTextContent('Goat pen 1');
    expect(facts).toHaveTextContent('26.400');
    expect(facts).toHaveTextContent('612.50');
    expect(facts).toHaveTextContent('850.00');
    const history = await screen.findByRole('list', { name: 'Events, newest first' });
    const events = within(history).getAllByRole('listitem');
    expect(events).toHaveLength(6);
    expect(screen.getByText('6 events, newest first')).toBeInTheDocument();
    // Newest first: the last weighing, then back to the day it was bought.
    expect(events[0]).toHaveTextContent('Weighed');
    // 1.25.0 recomputed the example's daily gain from its own weighings: 0.159, not 0.161.
    expect(events[0]).toHaveTextContent('average daily gain 0.159 kg');
    expect(events[5]).toHaveTextContent('Received');
    expect(events[5]).toHaveTextContent('Bought from Kpone Livestock Traders');
    expect(events[5]).toHaveTextContent('520.00');
    // The documents behind the events lead to their screens.
    expect(
      within(events[5] as HTMLElement).getByRole('link', { name: 'GRN-2026-DDW-000070' }),
    ).toHaveAttribute('href', '/goods-receipts/019a7aad-f16d-766e-bba7-6fbeee70e89c');
    // The history comes before the rest of the record in reading order.
    const record = screen.getByRole('heading', { name: 'Record' });
    expect(history.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('weighs the animal with a client id and says what was recorded', async () => {
    const user = userEvent.setup();
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Record weight' }));
    const dialog = await screen.findByRole('dialog', { name: 'Weigh G-0142, Goat' });
    await user.type(within(dialog).getByLabelText(/^Weight in kilograms/), '27.1');
    await user.click(within(dialog).getByRole('button', { name: 'Record weight' }));
    expect(await screen.findByText('G-0142 weighed at 27.100 kg.')).toBeInTheDocument();
  });

  it('a treatment is confirmed with its cost and withdrawal before it is sent', async () => {
    const user = userEvent.setup();
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Record treatment' }));
    const form = await screen.findByRole('dialog', { name: 'Treat G-0142, Goat' });
    await user.type(within(form).getByLabelText(/^Veterinary cost/), '42.50');
    await user.type(within(form).getByLabelText(/^Withdrawal days/), '14');
    await user.click(within(form).getByRole('button', { name: 'Review' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Record Treatment for G-0142, Goat?',
    });
    expect(confirm).toHaveTextContent('42.50');
    expect(confirm).toHaveTextContent('14 days');
    expect(confirm).toHaveTextContent('cannot be sold');
    await user.click(within(confirm).getByRole('button', { name: 'Record it' }));
    expect(
      await screen.findByText('Recorded. 1 animal cannot be sold until its withdrawal ends.'),
    ).toBeInTheDocument();
  });

  it('a move names the pen it leaves and the one it goes to before it is sent', async () => {
    const user = userEvent.setup();
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Move' }));
    const form = await screen.findByRole('dialog', { name: 'Move G-0142, Goat' });
    await user.click(within(form).getByRole('combobox', { name: /^To/ }));
    await user.click(await screen.findByRole('option', { name: 'Goat pen 2' }));
    await user.click(within(form).getByRole('button', { name: 'Review' }));
    const confirm = await screen.findByRole('dialog', { name: 'Move G-0142?' });
    expect(
      within(confirm).getByRole('row', { name: /Location Goat pen 1 Goat pen 2/ }),
    ).toBeInTheDocument();
  });

  it('not found, error and denied, in words', async () => {
    mock.prefer = 'code=404';
    mock.preferPath = '/animals';
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    expect(await screen.findByText('This animal is not in the register')).toBeInTheDocument();
    queryClient.clear();
    mock.prefer = 'code=500';
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('The animal could not be loaded')).toHaveTextContent(PRISM_500_REFERENCE),
    );
    queryClient.clear();
    mock.prefer = 'code=403';
    await renderApp(`/animals/${ANY_ID}`, await signedIn('owner'));
    await waitFor(() => expect(alertWith('You do not have access to this animal')).toBeDefined());
  });
});

describe('the records behind an animal', () => {
  it('weights, by pen and date, with how each was taken', async () => {
    await renderApp('/weights', await signedIn('owner'));
    const row = (await screen.findByRole('link', { name: 'G-0142' })).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('26.400');
    expect(row).toHaveTextContent('Scale');
    expect(screen.getByRole('button', { name: 'Weigh a pen' })).toBeEnabled();
  });

  it('health events name the animal or the pen, the medicine, the cost and the withdrawal', async () => {
    await renderApp('/health-events', await signedIn('owner'));
    expect(await screen.findByText('Every animal in Broiler house 1')).toBeInTheDocument();
    const row = screen.getByRole('link', { name: 'G-0163' }).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Oxytetracycline 20% injection, 100 ml');
    expect(row).toHaveTextContent('42.50');
  });

  it('deaths and culls, with the cost written off and where each stands', async () => {
    await renderApp('/mortality', await signedIn('owner'));
    const row = (await screen.findByRole('link', { name: 'G-0171' })).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Waiting for approval');
    expect(row).toHaveTextContent('589.00');
    expect(screen.getAllByText('Written off').length).toBeGreaterThan(0);
  });

  it('a death waiting for approval says the animal stays on hand, and offers no second submit', async () => {
    await renderApp(`/mortality/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Death of G-0171' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Waiting for a second person to approve/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit and write off' })).toBeNull();
  });

  it('breeding: matings, due dates and births, and one record with its young', async () => {
    await renderApp('/breeding', await signedIn('owner'));
    // 1.25.0: each record names its own dam, and G-0122's mating that did not take is listed.
    expect(await screen.findByRole('link', { name: 'Dam G-0118' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Did not take');
    queryClient.clear();
    await renderApp(`/breeding/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Breeding of G-0118' }),
    ).toBeInTheDocument();
    const young = screen.getByRole('heading', { name: 'Young' }).parentElement as HTMLElement;
    expect(within(young).getAllByRole('listitem')).toHaveLength(2);
  });

  it('feed given, and how one issue’s cost was shared over the animals', async () => {
    const user = userEvent.setup();
    await renderApp('/feed', await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: /^Goat pen 1, / }));
    const detail = await screen.findByRole('dialog', { name: 'Feed given' });
    await waitFor(() => expect(within(detail).getAllByRole('row').length).toBe(4));
    expect(detail).toHaveTextContent('2,080.00');
  });

  it('rations, per head per day in the unit’s own words', async () => {
    const user = userEvent.setup();
    await renderApp('/feed', await signedIn('owner'));
    await user.click(await screen.findByRole('tab', { name: 'Rations' }));
    expect(await screen.findByText('Goat supplement')).toBeInTheDocument();
  });

  it('each list’s empty and error states, in words', async () => {
    for (const [path, empty, error] of [
      ['/weights', 'No weights recorded', 'Weights could not be loaded'],
      ['/health-events', 'No health events', 'Health events could not be loaded'],
      ['/mortality', 'No deaths or culls recorded', 'Deaths and culls could not be loaded'],
      ['/breeding', 'No breeding records', 'Breeding records could not be loaded'],
    ] as const) {
      queryClient.clear();
      mock.prefer = null;
      mock.noRows = true;
      await renderApp(path, await signedIn('owner'));
      // Each screen is cold on its first visit here (its lazy chunk loads first): F5b's 5 s allowance.
      expect(await screen.findByText(empty, {}, { timeout: 5000 })).toBeInTheDocument();
      queryClient.clear();
      mock.noRows = false;
      mock.prefer = 'code=500';
      mock.preferPath = null;
      await renderApp(path, await signedIn('owner'));
      await waitFor(() => expect(alertWith(error)).toHaveTextContent(PRISM_500_REFERENCE));
    }
  });
});

describe('the Farm hand (A-158)', () => {
  it('reads weights only, and records the rest from there', async () => {
    await renderApp('/weights', await signedIn('farmHand'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Weights' })).toBeInTheDocument();
    const work = screen.getByRole('region', { name: 'Other pen work' });
    for (const action of ['Record a treatment', 'Record feed given']) {
      expect(within(work).getByRole('button', { name: action })).toBeEnabled();
    }
    // A death is reported and sent from its own page, which the Farm hand can open (F6b).
    expect(within(work).getByRole('link', { name: 'Report a death or cull' })).toHaveAttribute(
      'href',
      '/report-death',
    );
    // The register is not offered, and opening it says why in words.
    expect(screen.queryByRole('link', { name: 'Animals' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Weigh a pen' })).toBeNull();
  });

  it('looks an animal up by tag in the care register, which carries no cost (contract 1.26.0)', async () => {
    const user = userEvent.setup();
    await renderApp('/weights', await signedIn('farmHand'));
    await user.click(await screen.findByRole('button', { name: 'Weigh one animal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Which animal?' });
    await user.type(within(dialog).getByRole('combobox', { name: /Animal/ }), 'G-01');
    expect(await screen.findByRole('option', { name: 'G-0142, Goat' })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent('GH₵');
  });

  it('meets the register as permission denied, in words', async () => {
    await renderApp('/animals', await signedIn('farmHand'));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.queryByRole('table')).toBeNull();
  });
});
