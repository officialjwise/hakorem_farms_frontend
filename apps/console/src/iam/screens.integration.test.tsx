/**
 * Every F3 screen against the REAL Prism mock (ADR 0019), mounted through the app's own routes, shell and
 * providers, in its four states: loading (a held answer), empty (a list answered with no rows, until
 * CR-005; for a record, the contract's 404), error (the contract's 500, with its correlation id) and
 * permission denied (the contract's 403, in words, with no retry). The signed-in owner comes from the fake
 * auth server (ADR 0026); every read goes to Prism.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

/** The contract's 500 example carries this correlation id. */
const PRISM_500_REFERENCE = '019a7b1e-32bc-78e3-8e1c-970f89c10fed';
const ANY_ID = '019a7a86-3046-711a-a652-1a7389f79351';

afterEach(() => {
  queryClient.clear();
});

interface Case {
  screen: string;
  path: string;
  /** Text from the contract's example that shows the screen got its data. */
  ready: RegExp | string;
  loading: string;
  /** What the empty state says: no rows for a list, not found for a record. */
  empty: string;
  emptyBy: 'noRows' | '404';
  error: string;
  denied: string;
}

const CASES: Case[] = [
  {
    screen: 'users',
    path: '/users',
    ready: 'Akua Mensah',
    loading: 'Loading users',
    empty: 'No users match',
    emptyBy: 'noRows',
    error: 'Users could not be loaded',
    denied: 'You do not have access to users',
  },
  {
    screen: 'new user',
    path: '/users/new',
    ready: 'Full name',
    loading: 'Loading roles and branches',
    empty: 'Roles and branches could not be loaded',
    emptyBy: 'noRows',
    error: 'Roles and branches could not be loaded',
    denied: 'You cannot see the roles or branches a new user needs',
  },
  {
    screen: 'user',
    path: `/users/${ANY_ID}`,
    ready: 'akua.mensah@hakoremfarms.com',
    loading: 'Loading the user',
    empty: 'There is no user at this address',
    emptyBy: '404',
    error: 'This user could not be loaded',
    denied: 'You do not have access to this user',
  },
  {
    screen: 'roles',
    path: '/roles',
    ready: 'CASHIER',
    loading: 'Loading roles',
    empty: 'No roles yet',
    emptyBy: 'noRows',
    error: 'Roles could not be loaded',
    denied: 'You do not have access to roles',
  },
  {
    screen: 'role',
    path: `/roles/${ANY_ID}`,
    ready: /2 people hold this role/,
    loading: 'Loading the role',
    empty: 'There is no role at this address',
    emptyBy: '404',
    error: 'This role could not be loaded',
    denied: 'You do not have access to this role',
  },
  {
    screen: 'sessions',
    path: '/sessions',
    ready: 'Shop till tablet',
    loading: 'Loading sessions',
    empty: 'No sessions to show',
    emptyBy: 'noRows',
    error: 'Sessions could not be loaded',
    denied: 'You do not have access to sessions',
  },
  {
    screen: 'audit log',
    path: '/audit',
    ready: '2026-11-13 08:03',
    loading: 'Loading audit events',
    empty: 'No events match',
    emptyBy: 'noRows',
    error: 'The audit log could not be loaded',
    denied: 'You do not have access to the audit log',
  },
  {
    screen: 'audit event',
    path: `/audit/${ANY_ID}`,
    ready: '019a7a9b-9385-775f-bc98-7ecead58f7ac',
    loading: 'Loading the audit event',
    empty: 'There is no audit event at this address',
    emptyBy: '404',
    error: 'This audit event could not be loaded',
    denied: 'You do not have access to the audit log',
  },
];

describe.each(CASES)('the $screen screen against the Prism mock', (c) => {
  it('loading: a placeholder that names what is coming, then the data the mock served', async () => {
    const release = holdResponses();
    await renderApp(c.path, await signedIn('owner'));
    // The first case in a file loads its screen's modules cold: allow for it.
    expect((await screen.findAllByText(c.loading, {}, { timeout: 5000 })).length).toBeGreaterThan(
      0,
    );
    release();
    expect((await screen.findAllByText(c.ready)).length).toBeGreaterThan(0);
  });

  it(`empty: ${c.emptyBy === 'noRows' ? 'a list with no rows' : 'a record that is not there'} says so in words`, async () => {
    if (c.emptyBy === 'noRows') mock.noRows = true;
    else mock.prefer = 'code=404';
    await renderApp(c.path, await signedIn('owner'));
    expect((await screen.findAllByText(c.empty, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
  });

  it('error: what failed, the reference from the mock, and a retry', async () => {
    mock.prefer = 'code=500';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(c.error)),
      ).toBe(true),
    );
    const alert = screen.getAllByRole('alert').find((a) => a.textContent?.includes(c.error));
    expect(alert).toHaveTextContent(PRISM_500_REFERENCE);
    expect(within(alert as HTMLElement).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('permission denied: the server’s 403 in words, with no retry', async () => {
    mock.prefer = 'code=403';
    await renderApp(c.path, await signedIn('owner'));
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(c.denied)),
      ).toBe(true),
    );
    const alert = screen.getAllByRole('alert').find((a) => a.textContent?.includes(c.denied));
    expect(within(alert as HTMLElement).queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('the role screen reads every permission (ADR 0028)', () => {
  it('reads the list to its end and shows it, with nothing about a cap', async () => {
    await renderApp(`/roles/${ANY_ID}`, await signedIn('owner'));
    expect(
      await screen.findByRole('checkbox', { name: 'Make a counter sale' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('The permission list is longer than this screen can load'),
    ).toBeNull();
  });

  it('past the hard cap: words, no list, no retry and nothing to save', async () => {
    mock.endlessPages = true;
    await renderApp(`/roles/${ANY_ID}`, await signedIn('owner'));
    const words = 'The permission list is longer than this screen can load';
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes(words))).toBe(true),
    );
    const alert = screen.getAllByRole('alert').find((a) => a.textContent?.includes(words));
    expect(alert).toHaveTextContent('Nothing has been saved.');
    expect(within(alert as HTMLElement).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save role' })).toBeNull();
  });
});

describe('writes against the Prism mock', () => {
  it('creates a user and shows the temporary password once, from the answer', async () => {
    const user = userEvent.setup();
    await renderApp('/users/new', await signedIn('owner'));
    await user.type(await screen.findByLabelText(/^full name/i), 'Esi Boateng');
    await user.type(screen.getByLabelText(/^email/i), 'esi.boateng@hakoremfarms.com');
    await user.click(screen.getByRole('combobox', { name: /^role/i }));
    await user.click(await screen.findByRole('option', { name: 'Cashier' }));
    await user.click(screen.getByRole('combobox', { name: /^branch/i }));
    await user.click(await screen.findByRole('option', { name: 'HaKorem Farms, Dodowa (DDW)' }));
    await user.click(screen.getByRole('button', { name: 'Create user' }));
    // Prism answers with the contract's example account and its temporary password.
    expect(await screen.findByText('Temporary password')).toBeInTheDocument();
    // The link to the new account is the answer's id (Prism's example account), never a guess.
    expect(screen.getByRole('link', { name: 'Open Adwoa Darko' })).toHaveAttribute(
      'href',
      '/users/019a7a86-ac02-78a8-ade0-935170bb0c2f',
    );
  });

  it('a refused write leaves its words on screen with the reference', async () => {
    const user = userEvent.setup();
    await renderApp(`/users/${ANY_ID}`, await signedIn('owner'));
    await user.click(await screen.findByRole('button', { name: 'Disable account' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^reason/i), 'Left the business');
    mock.prefer = 'code=500';
    await user.click(within(dialog).getByRole('button', { name: 'Disable account' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(PRISM_500_REFERENCE);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
