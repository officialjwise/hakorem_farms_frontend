import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, MIN_REFRESH_INTERVAL_MS, REFRESH_LEAD_MS, useAuth } from './AuthProvider';

it('keeps silent refreshes at least 30 s apart', () => {
  expect(MIN_REFRESH_INTERVAL_MS).toBe(30_000);
});
import { ACCESS_TTL_MS } from '../test/fakeAuthServer';
import { fakeBrowser } from '../test/fakeFetch';
import { ApiError, NetworkError, type AuthClient } from './types';

const CASHIER = { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' };

function Probe() {
  const auth = useAuth();
  return (
    <p>
      status:{auth.status} user:{auth.session?.principal.displayName ?? 'none'} expires:
      {auth.session?.accessExpiresAt ?? 'none'}
    </p>
  );
}

async function mount(client: AuthClient) {
  render(
    <AuthProvider client={client}>
      <Probe />
    </AuthProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-11-14T08:00:00Z') });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AuthProvider: silent refresh and expiry', () => {
  it('boots into authenticated when the cookies already hold a session', async () => {
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    await mount(client);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
    expect(screen.getByText(/user:Adwoa Darko/)).toBeInTheDocument();
  });

  it('boots into anonymous with no cookies', async () => {
    await mount(fakeBrowser().client);
    expect(screen.getByText(/status:anonymous/)).toBeInTheDocument();
  });

  it('boots into error, not anonymous, when the server cannot be reached', async () => {
    const client = fakeBrowser().client;
    await mount({
      ...client,
      getCurrentSession: () => Promise.reject(new NetworkError()),
    });
    expect(screen.getByText(/status:error/)).toBeInTheDocument();
  });

  it('refreshes silently a minute before the access token expires, and stays signed in', async () => {
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    const refresh = vi.spyOn(client, 'refreshSession');
    await mount(client);
    const first = screen.getByText(/expires:/).textContent;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - REFRESH_LEAD_MS - 1000);
    });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
    expect(screen.getByText(/expires:/).textContent).not.toBe(first);

    // And again for the next ten minutes: the session is kept alive without the user doing anything.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
  });

  it('ends in expired when the refresh is refused with 401', async () => {
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    await mount({
      ...client,
      refreshSession: () =>
        Promise.reject(
          new ApiError({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Please log in again.',
            correlationId: 'x',
          }),
        ),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS);
    });
    expect(screen.getByText(/status:expired/)).toBeInTheDocument();
    expect(screen.getByText(/user:none/)).toBeInTheDocument();
  });

  it('keeps the session and retries when the refresh fails on the network, instead of signing the user out', async () => {
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    let offline = true;
    const real = client.refreshSession.bind(client);
    const refresh = vi.fn(() => (offline ? Promise.reject(new NetworkError()) : real()));
    await mount({ ...client, refreshSession: refresh });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - REFRESH_LEAD_MS + 100);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();

    offline = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
  });

  it('shares one refresh between concurrent callers, because a second one would revoke the session', async () => {
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    let release: () => void = () => undefined;
    const real = client.refreshSession.bind(client);
    const refresh = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<typeof real>>>((resolve) => {
          release = () => void real().then(resolve);
        }),
    );
    await mount({ ...client, refreshSession: refresh });
    // Two triggers at once: the timer, and the tab becoming visible again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - REFRESH_LEAD_MS + 100);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
  });

  it('refreshes at most once every 30 s when the expiry it is given is already past, instead of in a tight loop', async () => {
    // A device clock ahead of the server's, or Prism's fixed example, gives an accessExpiresAt in the past.
    const client = fakeBrowser().client;
    await client.loginStaff(CASHIER);
    const real = client.refreshSession.bind(client);
    const stale = '2026-11-13T09:10:00.000Z';
    const refresh = vi.fn(async () => ({ ...(await real()), accessExpiresAt: stale }));
    await mount({
      ...client,
      getCurrentSession: async () => ({
        ...(await client.getCurrentSession()),
        accessExpiresAt: stale,
      }),
      refreshSession: refresh,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(refresh).toHaveBeenCalledTimes(1); // the first one is due at once
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000); // fixed figures, so the test does not lean on the constant
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/status:authenticated/)).toBeInTheDocument();
  });
});
