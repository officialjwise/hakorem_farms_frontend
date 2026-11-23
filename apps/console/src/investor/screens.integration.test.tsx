/**
 * The investor portal (ADR 0058) against the REAL Prism mock: an investor signs in with `loginInvestor` at
 * `/login` on the portal's own host, reads their own figures, and a staff session is told it is in the wrong place. The
 * fake auth server holds the investor's account; Prism answers the investor operations from the contract.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { INVESTOR, newClient, renderApp, signedIn, signedInInvestor } from '../test/harness';
import { mock } from '../test/integration-setup';
import { investorRoutes } from './routes';

const PORTAL = { realm: 'INVESTOR' } as const;

afterEach(() => {
  queryClient.clear();
});

describe('the investor portal', () => {
  it('an investor signs in at the portal and reads their own capital, share and returns', async () => {
    const user = userEvent.setup();
    const client = newClient();
    await renderApp('/login', client, investorRoutes, undefined, PORTAL);
    await user.type(
      await screen.findByLabelText(/email or phone number/i, {}, { timeout: 5000 }),
      INVESTOR.identifier,
    );
    await user.type(screen.getByLabelText(/^password/i), INVESTOR.password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your investment' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    const tiles = await screen.findByRole('list', { name: 'Your investment' });
    expect(tiles).toHaveTextContent('Your share');
    expect(tiles).toHaveTextContent('Capital contributed');
    expect(tiles).toHaveTextContent('GH₵');
    expect(screen.getByText(/Esi Bonsu · Investor/)).toBeInTheDocument();
    expect(screen.getByText('Signed in as Esi Bonsu')).toBeInTheDocument();
    // The portal's nav names only the investor's own pages.
    const nav = screen.getByRole('navigation', { name: 'Investor portal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Summary', 'Contributions', 'Distributions', 'Statement', 'Documents']);
  });

  it('contributions, distributions, the statement and documents, each from its own operation', async () => {
    const client = await signedInInvestor();
    const open = async (path: string) => {
      queryClient.clear();
      return renderApp(path, client, investorRoutes, undefined, PORTAL);
    };
    let view = await open('/capital');
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Contribution'), {
      timeout: 5000,
    });
    view.unmount();
    view = await open('/distributions');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your share of each distribution' }),
    ).toBeInTheDocument();
    view.unmount();
    view = await open('/statement');
    expect(
      await screen.findByText('Capital at the start', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    view.unmount();
    await open('/documents');
    await waitFor(
      () => expect(screen.getByRole('table')).toHaveTextContent('Investment agreement'),
      {
        timeout: 5000,
      },
    );
  });

  it('a staff session in the portal is told so in words, and sees nothing behind it', async () => {
    await renderApp('/', await signedIn('owner'), investorRoutes, undefined, PORTAL);
    expect(
      await screen.findByText('You are signed in as staff', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Your investment')).toBeNull();
    expect(mock.requests.some((url) => url.pathname.startsWith('/investor/'))).toBe(false);
  });

  it('the summary failing says so with its reference', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/investor/me';
    await renderApp('/', await signedInInvestor(), investorRoutes, undefined, PORTAL);
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('alert')
            .some((alert) => alert.textContent?.includes('Your investment could not be loaded')),
        ).toBe(true),
      { timeout: 5000 },
    );
  });
});
