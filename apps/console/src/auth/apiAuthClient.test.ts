import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TTL_MS,
  createFakeAuthServer,
  FAKE_RESET_CODE,
  FAKE_TOTP_CODE,
  REFRESH_TTL_MS,
  type CookieJar,
  type FakeAuthServer,
} from '../test/fakeAuthServer';
import { FAKE_BASE_URL, fakeBrowser, fakeFetch } from '../test/fakeFetch';
import { createApiAuthClient } from './apiAuthClient';
import { ApiError, NetworkError, type AuthClient, type SessionInfo } from './types';

/**
 * The real auth client (ADR 0024) against the fake auth server (ADR 0026). The first part pins the client's
 * own rules: the contract's method and path for each operation, a 401 that is an answer and never a
 * refresh, and the CSRF token from the last session response. The rest is the behaviour the F1 stub's
 * tests described, now through the client the app ships.
 */

const OWNER = { identifier: 'kwabena.owusu@hakoremfarms.com', password: 'Mango-Season-2026!' };
const CASHIER = { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' };
const TEMP = { identifier: 'new.staff@hakoremfarms.com', password: 'Temp-8841-Farm' };
const NEW_PASSWORD = 'A-much-longer-passphrase-9';

let server: FakeAuthServer;
let jar: CookieJar;
let client: AuthClient;
let clock: number;

beforeEach(() => {
  // Only Date is frozen: the client's own timeout timer still runs.
  vi.useFakeTimers({ now: Date.parse('2026-11-14T08:00:00Z'), toFake: ['Date'] });
  clock = Date.now();
  ({ server, jar, client } = fakeBrowser());
});
afterEach(() => {
  vi.useRealTimers();
});

function tick(ms: number) {
  clock += ms;
  server.clock.advance(ms);
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to be rejected with an ApiError.');
}

async function signIn(): Promise<SessionInfo> {
  const result = await client.loginStaff(CASHIER);
  if (result.session === null) throw new Error('expected a session');
  return result.session;
}

/** A client whose requests are recorded before the fake answers them. */
function recorded(): { client: AuthClient; requests: Request[] } {
  const requests: Request[] = [];
  const answer = fakeFetch(server, jar);
  const recording = createApiAuthClient({
    baseUrl: FAKE_BASE_URL,
    fetch: (request) => {
      requests.push(request.clone());
      return answer(request);
    },
  });
  return { client: recording, requests };
}

describe('the real auth client: its own rules', () => {
  it('calls each operation at the method and path the contract gives it', async () => {
    const { client: c, requests } = recorded();
    await c.loginStaff(CASHIER);
    await c.getCurrentSession();
    await c.refreshSession();
    await c.changePassword({ currentPassword: CASHIER.password, newPassword: NEW_PASSWORD });
    await c.requestPasswordReset({ identifier: 'anyone@example.com' });
    await c.resetPassword({ token: FAKE_RESET_CODE, newPassword: NEW_PASSWORD });
    await c.logout();
    const owner = await c.loginStaff(OWNER);
    await c.verifyTotp({ challengeToken: owner.challengeToken ?? '', code: FAKE_TOTP_CODE });
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'POST /auth/staff/login',
      'GET /auth/session',
      'POST /auth/refresh',
      'POST /auth/password/change',
      'POST /auth/password/reset-request',
      'POST /auth/password/reset',
      'POST /auth/logout',
      'POST /auth/staff/login',
      'POST /auth/totp/verify',
    ]);
    // None of the auth operations requires an idempotency key in contract 1.1.0, so none is sent.
    expect(requests.some((r) => r.headers.has('Idempotency-Key'))).toBe(false);
  });

  it('treats a 401 as the answer: no refresh is attempted behind the caller’s back', async () => {
    const { client: c, requests } = recorded();
    expect(await rejection(c.getCurrentSession())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(requests).toHaveLength(1);
  });

  it('sends the CSRF token of the last session response, and the newest one after a refresh', async () => {
    const { client: c, requests } = recorded();
    const login = await c.loginStaff(CASHIER);
    const refreshed = await c.refreshSession();
    expect(refreshed.csrfToken).not.toBe(login.session?.csrfToken);
    await c.logout();
    expect(requests.at(-1)?.headers.get('X-CSRF-Token')).toBe(refreshed.csrfToken);
  });

  it('forgets the CSRF token on logout, whatever the answer', async () => {
    const { client: c, requests } = recorded();
    await c.loginStaff(CASHIER);
    await c.logout();
    await rejection(c.logout()); // no session any more: 401
    expect(requests.at(-1)?.headers.has('X-CSRF-Token')).toBe(false);
  });

  it('asks for a staff reset: realm STAFF is added to the request', async () => {
    const { client: c, requests } = recorded();
    await c.requestPasswordReset({ identifier: 'anyone@example.com' });
    expect(await requests[0]?.json()).toEqual({ identifier: 'anyone@example.com', realm: 'STAFF' });
  });

  it('turns no answer into a NetworkError, which AuthProvider reads as "could not reach"', async () => {
    const offline = createApiAuthClient({
      baseUrl: FAKE_BASE_URL,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(offline.getCurrentSession()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('sign in', () => {
  it('signs a user without TOTP straight in, with a session body that matches SessionInfo', async () => {
    const result = await client.loginStaff(CASHIER);
    expect(result.status).toBe('AUTHENTICATED');
    expect(result.challengeToken).toBeNull();
    expect(result.session).toMatchObject({
      realm: 'STAFF',
      mustChangePassword: false,
      steppedUpAt: null,
      principal: { displayName: 'Adwoa Darko' },
    });
    expect(result.session?.permissions).toContain('pos.sale.create');
    expect(result.session?.csrfToken).toMatch(/^[0-9a-f]{32}$/);
  });

  it('sets the access cookie for ten minutes and the refresh cookie for the session lifetime', async () => {
    const session = await signIn();
    expect(Date.parse(session.accessExpiresAt) - clock).toBe(ACCESS_TTL_MS);
    expect(Date.parse(session.refreshExpiresAt) - clock).toBe(REFRESH_TTL_MS);
    expect((jar.at?.expires ?? 0) - clock).toBe(ACCESS_TTL_MS);
    expect((jar.rt?.expires ?? 0) - clock).toBe(REFRESH_TTL_MS);
  });

  it('answers a wrong password and an unknown account identically, with 401 INVALID_CREDENTIALS', async () => {
    const wrong = await rejection(client.loginStaff({ ...CASHIER, password: 'nope' }));
    const unknown = await rejection(
      client.loginStaff({ identifier: 'who@example.com', password: 'nope' }),
    );
    expect(wrong).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(unknown.code).toBe(wrong.code);
    expect(unknown.message).toBe(wrong.message);
    expect(wrong.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('backs off with 429 RATE_LIMITED and a Retry-After after repeated failures, then lets the account try again', async () => {
    for (let i = 0; i < 5; i++)
      await rejection(client.loginStaff({ ...CASHIER, password: 'nope' }));
    const limited = await rejection(client.loginStaff(CASHIER));
    expect(limited).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 30 });
    tick(31_000);
    expect((await client.loginStaff(CASHIER)).status).toBe('AUTHENTICATED');
  });

  it('asks a TOTP user for a code first, and the challenge is not a session', async () => {
    const result = await client.loginStaff(OWNER);
    expect(result).toMatchObject({ status: 'TOTP_REQUIRED', session: null });
    expect(result.challengeToken).toMatch(/^hk1\.ch\./);
    expect(jar).toEqual({});
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });

  it('asks a temporary-password user to change it before any session exists', async () => {
    const result = await client.loginStaff(TEMP);
    expect(result).toMatchObject({ status: 'PASSWORD_CHANGE_REQUIRED', session: null });
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });
});

describe('TOTP', () => {
  it('turns the challenge and the right code into a session and cookies', async () => {
    const { challengeToken } = await client.loginStaff(OWNER);
    const result = await client.verifyTotp({
      challengeToken: challengeToken ?? '',
      code: FAKE_TOTP_CODE,
    });
    expect(result.status).toBe('AUTHENTICATED');
    expect(result.session?.principal.displayName).toBe('Kwabena Owusu');
    expect((await client.getCurrentSession()).sessionId).toBe(result.session?.sessionId);
  });

  it('refuses a wrong code with 401 TOTP_INVALID and burns the challenge after five tries', async () => {
    const { challengeToken } = await client.loginStaff(OWNER);
    const token = challengeToken ?? '';
    expect(
      (await rejection(client.verifyTotp({ challengeToken: token, code: '000000' }))).code,
    ).toBe('TOTP_INVALID');
    for (let i = 0; i < 4; i++)
      await rejection(client.verifyTotp({ challengeToken: token, code: '000000' }));
    const gone = await rejection(
      client.verifyTotp({ challengeToken: token, code: FAKE_TOTP_CODE }),
    );
    expect(gone.code).toBe('CHALLENGE_EXPIRED');
  });

  it('refuses a challenge that has expired or was already used', async () => {
    const { challengeToken } = await client.loginStaff(OWNER);
    const token = challengeToken ?? '';
    await client.verifyTotp({ challengeToken: token, code: FAKE_TOTP_CODE });
    expect(
      (await rejection(client.verifyTotp({ challengeToken: token, code: FAKE_TOTP_CODE }))).code,
    ).toBe('CHALLENGE_EXPIRED');
    const second = await client.loginStaff(OWNER);
    tick(6 * 60_000);
    expect(
      (
        await rejection(
          client.verifyTotp({ challengeToken: second.challengeToken ?? '', code: FAKE_TOTP_CODE }),
        )
      ).code,
    ).toBe('CHALLENGE_EXPIRED');
  });
});

describe('access cookie expiry and refresh', () => {
  it('drops the access cookie when it expires, so the session call answers 401 UNAUTHENTICATED', async () => {
    await signIn();
    tick(ACCESS_TTL_MS - 1);
    await expect(client.getCurrentSession()).resolves.toBeDefined();
    tick(2);
    expect(await rejection(client.getCurrentSession())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('refreshes with the refresh cookie: a new access expiry, a new CSRF token and a rotated refresh token', async () => {
    const first = await signIn();
    const before = structuredClone(jar);
    tick(ACCESS_TTL_MS + 1000); // the access cookie is gone by now
    const next = await client.refreshSession();
    expect(next.sessionId).toBe(first.sessionId);
    expect(next.csrfToken).not.toBe(first.csrfToken);
    expect(Date.parse(next.accessExpiresAt)).toBe(clock + ACCESS_TTL_MS);
    expect(jar.rt?.value).not.toBe(before.rt?.value);
    expect(jar.at?.value).not.toBe(before.at?.value);
    await expect(client.getCurrentSession()).resolves.toBeDefined();
  });

  it('keeps the same absolute refresh deadline across rotations', async () => {
    const first = await signIn();
    tick(5 * 60_000);
    const next = await client.refreshSession();
    expect(next.refreshExpiresAt).toBe(first.refreshExpiresAt);
  });

  it('revokes the whole session when a rotated refresh token is presented again', async () => {
    await signIn();
    const stale = structuredClone(jar);
    await client.refreshSession(); // rotates
    const newest = structuredClone(jar);
    Object.assign(jar, stale); // a copied, already-used token
    expect(await rejection(client.refreshSession())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    // The legitimate holder of the newest token is out as well.
    Object.assign(jar, newest);
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
    expect((await rejection(client.refreshSession())).status).toBe(401);
  });

  it('answers 401 when there is no refresh cookie, and when the refresh lifetime has passed', async () => {
    expect((await rejection(client.refreshSession())).status).toBe(401);
    await signIn();
    tick(REFRESH_TTL_MS + 1);
    expect((await rejection(client.refreshSession())).status).toBe(401);
  });

  it('survives a reload: a new client over the same cookies still has the session', async () => {
    const session = await signIn();
    const reloaded = fakeBrowser({ server, jar }).client;
    expect((await reloaded.getCurrentSession()).sessionId).toBe(session.sessionId);
  });

  it('answers 401 once a manager has revoked the session', async () => {
    await signIn();
    server.revokeAllSessions();
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
    expect((await rejection(client.refreshSession())).status).toBe(401);
  });
});

describe('logout and CSRF', () => {
  it('logs out with the CSRF token it was issued, clears the cookies and ends the session', async () => {
    await signIn();
    await client.logout();
    expect(jar).toEqual({});
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });

  it('refuses a state-changing call from a client that does not hold the current CSRF token', async () => {
    await signIn();
    const otherTab = fakeBrowser({ server, jar }).client; // has the cookies, not the token
    expect(await rejection(otherTab.logout())).toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_INVALID',
    });
  });

  it('a reloaded tab learns the token from the boot check and can sign out', async () => {
    await signIn();
    const reloaded = fakeBrowser({ server, jar }).client;
    await reloaded.getCurrentSession();
    await expect(reloaded.logout()).resolves.toBeUndefined();
  });
});

describe('passwords', () => {
  it('changes the temporary password at first login, then accepts only the new one', async () => {
    await client.loginStaff(TEMP);
    await client.changePassword({ currentPassword: TEMP.password, newPassword: NEW_PASSWORD });
    expect((await rejection(client.loginStaff(TEMP))).code).toBe('INVALID_CREDENTIALS');
    const result = await client.loginStaff({ identifier: TEMP.identifier, password: NEW_PASSWORD });
    expect(result.status).toBe('AUTHENTICATED');
  });

  it('refuses a short password with a field detail on /newPassword, and a breached one with PASSWORD_BREACHED', async () => {
    await client.loginStaff(TEMP);
    const short = await rejection(
      client.changePassword({ currentPassword: TEMP.password, newPassword: 'short' }),
    );
    expect(short).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(short.details[0]?.field).toBe('/newPassword');
    const breached = await rejection(
      client.changePassword({ currentPassword: TEMP.password, newPassword: 'password-password' }),
    );
    expect(breached).toMatchObject({ status: 422, code: 'PASSWORD_BREACHED' });
  });

  it('refuses a wrong current password', async () => {
    await client.loginStaff(TEMP);
    expect(
      (
        await rejection(
          client.changePassword({ currentPassword: 'wrong', newPassword: NEW_PASSWORD }),
        )
      ).code,
    ).toBe('INVALID_CREDENTIALS');
  });

  it('answers a reset request the same way for any identifier, and resets only with the right code', async () => {
    await expect(
      client.requestPasswordReset({ identifier: 'anyone@example.com' }),
    ).resolves.toBeUndefined();
    await expect(
      client.requestPasswordReset({ identifier: CASHIER.identifier }),
    ).resolves.toBeUndefined();
    expect(
      (await rejection(client.resetPassword({ token: 'wrong', newPassword: NEW_PASSWORD }))).status,
    ).toBe(422);
    await expect(
      client.resetPassword({ token: FAKE_RESET_CODE, newPassword: NEW_PASSWORD }),
    ).resolves.toBeUndefined();
  });
});

describe('step-up', () => {
  async function signedInOwner() {
    const { challengeToken } = await client.loginStaff(OWNER);
    await client.verifyTotp({ challengeToken: challengeToken ?? '', code: FAKE_TOTP_CODE });
  }

  it('steps up the current session with the CSRF token: the answer carries a new steppedUpAt', async () => {
    const { client: c, requests } = recorded();
    const { challengeToken } = await c.loginStaff(OWNER);
    const login = await c.verifyTotp({
      challengeToken: challengeToken ?? '',
      code: FAKE_TOTP_CODE,
    });
    expect(login.session?.steppedUpAt).toBeNull();
    const session = await c.stepUp({ code: FAKE_TOTP_CODE });
    expect(session.steppedUpAt).toBe('2026-11-14T08:00:00.000Z');
    const last = requests.at(-1);
    expect(`${last?.method} ${new URL(last?.url ?? FAKE_BASE_URL).pathname}`).toBe(
      'POST /auth/step-up',
    );
    expect(last?.headers.get('X-CSRF-Token')).toBe(login.session?.csrfToken);
  });

  it('refuses a wrong code with 401 TOTP_INVALID and leaves the session without a step-up', async () => {
    await signedInOwner();
    expect((await rejection(client.stepUp({ code: '000000' }))).code).toBe('TOTP_INVALID');
    expect((await client.getCurrentSession()).steppedUpAt).toBeNull();
  });

  it('refuses a step-up operation until the session stepped up, and again five minutes later', async () => {
    await signedInOwner();
    expect(server.stepUpRefusal(jar, 'createGrant')?.status).toBe(403);
    expect(server.stepUpRefusal(jar, 'listUsers')).toBeNull();
    await client.stepUp({ code: FAKE_TOTP_CODE });
    expect(server.stepUpRefusal(jar, 'createGrant')).toBeNull();
    tick(5 * 60 * 1000);
    expect(
      (server.stepUpRefusal(jar, 'createGrant')?.body as { error: { code: string } }).error.code,
    ).toBe('STEP_UP_REQUIRED');
  });
});

describe('the fake server itself', () => {
  it('answers only the nine auth operations', () => {
    const fresh = createFakeAuthServer();
    expect(
      fresh.handle({ method: 'GET', path: '/iam/users', headers: {}, body: undefined }, {}),
    ).toBeNull();
  });
});
