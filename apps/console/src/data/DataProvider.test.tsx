import { ApiError, createApiClient } from '@hakorem/api-client';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { createStubAuthClient } from '../auth/stub';
import type { AuthClient } from '../auth/types';
import { memoryStorage } from '../test/memoryStorage';
import { queryClient } from './api';
import { DataProvider } from './DataProvider';
import { sessionHooks } from './session';

const CASHIER = { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' };

function Probe() {
  const auth = useAuth();
  return (
    <>
      <p>status:{auth.status}</p>
      <button type="button" onClick={() => void auth.logout()}>
        sign out
      </button>
    </>
  );
}

async function mount(client: AuthClient) {
  render(
    <AuthProvider client={client}>
      <DataProvider>
        <Probe />
      </DataProvider>
    </AuthProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

const refused = () =>
  new Response(
    JSON.stringify({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Please log in again.',
        correlationId: 'c',
        details: [],
      },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-11-14T08:00:00Z') });
  queryClient.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DataProvider: the data layer on the console session', () => {
  it('refreshes the AuthProvider session once for concurrent 401s, then retries with the new CSRF token', async () => {
    const stub = createStubAuthClient({ storage: memoryStorage() });
    await stub.loginStaff(CASHIER);
    const refresh = vi.fn(() => stub.refreshSession());
    await mount({ ...stub, refreshSession: refresh });
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();

    const seen: Request[] = [];
    let refreshedToken: string | null = null;
    const api = createApiClient({
      baseUrl: 'http://api.test',
      session: sessionHooks,
      fetch: async (request) => {
        seen.push(request.clone());
        if (refresh.mock.calls.length === 0) return refused();
        refreshedToken ??= (await stub.getCurrentSession()).csrfToken;
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });

    await act(async () => {
      await Promise.all([
        api.call('getCurrentSession'),
        api.call('getCurrentSession'),
        api.call('getCurrentSession'),
      ]);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(6);
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
  });

  it('lands the app on session expiry, in words, when the refresh is refused', async () => {
    const stub = createStubAuthClient({ storage: memoryStorage() });
    await stub.loginStaff(CASHIER);
    const refresh = vi.fn(() =>
      Promise.reject(
        new ApiError({
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'Please log in again.',
          correlationId: 'c',
        }),
      ),
    );
    await mount({ ...stub, refreshSession: refresh });

    const api = createApiClient({
      baseUrl: 'http://api.test',
      session: sessionHooks,
      fetch: async () => refused(),
    });
    await act(async () => {
      await Promise.all(
        [api.call('getCurrentSession'), api.call('getCurrentSession')].map((p) =>
          p.catch(() => undefined),
        ),
      );
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('status:expired')).toBeInTheDocument();
  });

  it('drops every cached answer when the user signs out, so the next person sees none of it', async () => {
    const stub = createStubAuthClient({ storage: memoryStorage() });
    await stub.loginStaff(CASHIER);
    await mount(stub);
    queryClient.setQueryData(['listProducts'], { data: ['secret'] });
    expect(queryClient.getQueryData(['listProducts'])).toBeDefined();
    await act(async () => {
      screen.getByRole('button', { name: 'sign out' }).click();
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText('status:anonymous')).toBeInTheDocument();
    expect(queryClient.getQueryData(['listProducts'])).toBeUndefined();
  });
});
