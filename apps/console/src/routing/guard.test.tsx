import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGate } from './gates';
import { renderApp, signedIn, newClient, USERS } from '../test/harness';
import { NetworkError, type AuthClient } from '../auth/types';

describe('route guard: the four session states', () => {
  it('loading: says it is checking the session, and shows no page yet', async () => {
    const client = { ...newClient(), getCurrentSession: () => new Promise<never>(() => undefined) };
    await renderApp('/stock', client);
    expect(await screen.findByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('error: the session check could not reach the server, so it says so and offers a retry', async () => {
    const real = newClient();
    let failing = true;
    const client: AuthClient = {
      ...real,
      getCurrentSession: async () => {
        if (failing) throw new NetworkError();
        return real.getCurrentSession();
      },
    };
    await renderApp('/', client);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not check your session/i);
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    // Still no cookies, so the retry lands on the sign-in screen rather than the same error.
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('anonymous: goes to sign-in and remembers where the user was going', async () => {
    const { router } = await renderApp('/stock', newClient());
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fstock');
  });
});

describe('route guard: permissions', () => {
  it('denies a signed-in user who lacks the permission, with words and the permission needed, and stays on the URL', async () => {
    const { router } = await renderApp('/users', await signedIn('cashier'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/do not have access/i);
    expect(alert).toHaveTextContent('iam.user.read');
    expect(router.state.location.pathname).toBe('/users');
    // The shell is still around it, so the user is not stranded.
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('lets a user in who holds the permission', async () => {
    const client = newClient();
    const login = await client.loginStaff(USERS.manager);
    await client.verifyTotp({ challengeToken: login.challengeToken ?? '', code: '481205' });
    await renderApp('/users', client);
    expect(await screen.findByRole('heading', { name: /users and roles/i })).toBeInTheDocument();
    expect(screen.queryByText(/do not have access/i)).not.toBeInTheDocument();
  });

  it('lets any signed-in user open a route that declares permission null (the dashboard)', async () => {
    await renderApp('/', await signedIn('storekeeper'));
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('denies the POS shell without rendering any of it, and offers a way out', async () => {
    await renderApp('/pos', await signedIn('storekeeper'));
    expect(await screen.findByRole('alert')).toHaveTextContent('pos.sale.create');
    expect(screen.queryByLabelText(/barcode/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start page/i })).toBeInTheDocument();
  });

  it('only offers navigation the user may use', async () => {
    await renderApp('/', await signedIn('storekeeper'));
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    expect(nav).toHaveTextContent(/stock/i);
    expect(nav).not.toHaveTextContent(/users and roles/i);
    expect(nav).not.toHaveTextContent(/point of sale/i);
  });

  it('denies by default: a route that declares no permission is refused', async () => {
    const routes = [
      {
        path: '/undeclared',
        element: (
          <PermissionGate>
            <p>secret</p>
          </PermissionGate>
        ),
      },
    ];
    await renderApp('/undeclared', await signedIn('cashier'), routes);
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends a user who must change their password to the change-password screen', async () => {
    const real = await signedIn('cashier');
    const client: AuthClient = {
      ...real,
      getCurrentSession: async () => ({
        ...(await real.getCurrentSession()),
        mustChangePassword: true,
      }),
    };
    const { router } = await renderApp('/stock', client);
    await waitFor(() => expect(router.state.location.pathname).toBe('/change-password'));
  });

  it('shows a not-found page for an address that does not exist', async () => {
    await renderApp('/nope/at/all', await signedIn('cashier'));
    expect(await screen.findByText(/this page does not exist/i)).toBeInTheDocument();
  });
});

describe('route guard: spy sanity', () => {
  it('does not call the server again for every render', async () => {
    const real = await signedIn('cashier');
    const spy = vi.spyOn(real, 'getCurrentSession');
    await renderApp('/', real);
    await screen.findByRole('heading', { name: /dashboard/i });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
