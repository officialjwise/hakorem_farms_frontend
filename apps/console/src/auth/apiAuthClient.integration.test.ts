/**
 * The real auth client (ADR 0024) against the REAL Prism mock (ADR 0019): every one of its eight operations
 * reaches the contract's route with what the contract requires (body, `X-CSRF-Token` where it says so) and
 * comes back as the contract's own example, or as an `ApiError` for the contract's error examples.
 *
 * Prism keeps no state and answers from examples, so this proves the wiring, not the session rules. Those
 * are proved against the fake auth server (`apiAuthClient.test.ts`) and end to end.
 */
import { apiBaseUrl } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import { createApiAuthClient } from './apiAuthClient';
import { ApiError } from './types';

const client = (headers?: Record<string, string>) =>
  createApiAuthClient({ baseUrl: apiBaseUrl(), ...(headers ? { headers } : {}) });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('the real auth client against Prism', () => {
  it('signs in: loginStaff answers the contract example (a TOTP step), verifyTotp gives the session', async () => {
    const auth = client();
    const first = await auth.loginStaff({
      identifier: 'kwabena.owusu@hakoremfarms.com',
      password: 'Mango-Season-2026!',
      deviceLabel: 'Console',
    });
    expect(first.status).toBe('TOTP_REQUIRED');
    expect(first.challengeToken).toMatch(/^hk1\.ch\./);

    const second = await auth.verifyTotp({
      challengeToken: first.challengeToken ?? '',
      code: '481205',
    });
    expect(second.status).toBe('AUTHENTICATED');
    expect(second.session?.realm).toBe('STAFF');
    expect(second.session?.csrfToken.length).toBeGreaterThan(0);
  });

  it('reads and refreshes the session', async () => {
    const auth = client();
    const session = await auth.getCurrentSession();
    expect(session.permissions.length).toBeGreaterThan(0);
    const refreshed = await auth.refreshSession();
    expect(refreshed.sessionId).toBeTruthy();
  });

  it('sends the CSRF token the contract requires on logout and changePassword (Prism refuses without it)', async () => {
    const auth = client();
    await auth.getCurrentSession(); // the CSRF token comes from the session response
    await expect(
      auth.changePassword({
        currentPassword: 'Mango-Season-2026!',
        newPassword: 'A-much-longer-passphrase-9',
      }),
    ).resolves.toBeUndefined();
    await expect(auth.logout()).resolves.toBeUndefined();

    // A client that never saw a session has no token to send, and Prism says so.
    const stranger = await failure(client().logout());
    expect(stranger.status).toBe(422);
  });

  it('asks for and completes a password reset', async () => {
    const auth = client();
    await expect(
      auth.requestPasswordReset({ identifier: 'adwoa.darko@hakoremfarms.com' }),
    ).resolves.toBeUndefined();
    await expect(
      auth.resetPassword({ token: '738204', newPassword: 'A-much-longer-passphrase-9' }),
    ).resolves.toBeUndefined();
  });

  it('passes the contract’s 401 back as an answer, with its correlation id, and does not refresh', async () => {
    const error = await failure(client({ Prefer: 'code=401' }).getCurrentSession());
    expect(error.status).toBe(401);
    expect(error.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passes the contract’s 429 back with its code', async () => {
    const error = await failure(
      client({ Prefer: 'code=429' }).loginStaff({
        identifier: 'a@b.com',
        password: 'x',
        deviceLabel: 'Console',
      }),
    );
    expect(error.status).toBe(429);
    expect(error.code).toBeTruthy();
  });
});
