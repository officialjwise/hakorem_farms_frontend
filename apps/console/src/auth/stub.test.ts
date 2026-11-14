import { beforeEach, describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';
import {
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  STUB_RESET_CODE,
  STUB_TOTP_CODE,
  createStubAuthClient,
} from './stub';
import { ApiError, type AuthClient, type SessionInfo } from './types';

const OWNER = { identifier: 'kwabena.owusu@hakoremfarms.com', password: 'Mango-Season-2026!' };
const CASHIER = { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' };
const TEMP = { identifier: 'new.staff@hakoremfarms.com', password: 'Temp-8841-Farm' };

let clock: number;
let storage: ReturnType<typeof memoryStorage>;
let client: AuthClient;

beforeEach(() => {
  clock = Date.parse('2026-11-14T08:00:00Z');
  storage = memoryStorage();
  client = createStubAuthClient({ now: () => clock, storage });
});

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

describe('stub auth: login', () => {
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
    const jar = JSON.parse(storage.getItem('hk-stub:cookies') ?? '{}');
    expect(jar.at.expires - clock).toBe(ACCESS_TTL_MS);
    expect(jar.rt.expires - clock).toBe(REFRESH_TTL_MS);
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

  it('backs off with 429 RATE_LIMITED after repeated failures, then lets the account try again', async () => {
    for (let i = 0; i < 5; i++)
      await rejection(client.loginStaff({ ...CASHIER, password: 'nope' }));
    const limited = await rejection(client.loginStaff(CASHIER));
    expect(limited).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(limited.retryAfter).toBeGreaterThan(0);
    clock += 31_000;
    expect((await client.loginStaff(CASHIER)).status).toBe('AUTHENTICATED');
  });

  it('asks a TOTP user for a code first, and the challenge is not a session', async () => {
    const result = await client.loginStaff(OWNER);
    expect(result).toMatchObject({ status: 'TOTP_REQUIRED', session: null });
    expect(result.challengeToken).toMatch(/^hk1\.ch\./);
    expect(storage.getItem('hk-stub:cookies')).toBeNull();
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });

  it('asks a temporary-password user to change it before any session exists', async () => {
    const result = await client.loginStaff(TEMP);
    expect(result).toMatchObject({ status: 'PASSWORD_CHANGE_REQUIRED', session: null });
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });
});

describe('stub auth: TOTP', () => {
  it('turns the challenge and the right code into a session and cookies', async () => {
    const { challengeToken } = await client.loginStaff(OWNER);
    const result = await client.verifyTotp({
      challengeToken: challengeToken ?? '',
      code: STUB_TOTP_CODE,
    });
    expect(result.status).toBe('AUTHENTICATED');
    expect(result.session?.principal.displayName).toBe('Kwabena Owusu');
    expect((await client.getCurrentSession()).sessionId).toBe(result.session?.sessionId);
  });

  it('refuses a wrong code with 401 TOTP_INVALID and burns the challenge after five tries', async () => {
    const { challengeToken = '' } = await client.loginStaff(OWNER);
    expect(
      (await rejection(client.verifyTotp({ challengeToken: challengeToken ?? '', code: '000000' })))
        .code,
    ).toBe('TOTP_INVALID');
    for (let i = 0; i < 4; i++)
      await rejection(client.verifyTotp({ challengeToken: challengeToken ?? '', code: '000000' }));
    const gone = await rejection(
      client.verifyTotp({ challengeToken: challengeToken ?? '', code: STUB_TOTP_CODE }),
    );
    expect(gone.code).toBe('CHALLENGE_EXPIRED');
  });

  it('refuses a challenge that has expired or was already used', async () => {
    const { challengeToken } = await client.loginStaff(OWNER);
    await client.verifyTotp({ challengeToken: challengeToken ?? '', code: STUB_TOTP_CODE });
    expect(
      (
        await rejection(
          client.verifyTotp({ challengeToken: challengeToken ?? '', code: STUB_TOTP_CODE }),
        )
      ).code,
    ).toBe('CHALLENGE_EXPIRED');
    const second = await client.loginStaff(OWNER);
    clock += 6 * 60_000;
    expect(
      (
        await rejection(
          client.verifyTotp({ challengeToken: second.challengeToken ?? '', code: STUB_TOTP_CODE }),
        )
      ).code,
    ).toBe('CHALLENGE_EXPIRED');
  });
});

describe('stub auth: access cookie expiry and refresh', () => {
  it('drops the access cookie when it expires, so the session call answers 401 UNAUTHENTICATED', async () => {
    await signIn();
    clock += ACCESS_TTL_MS - 1;
    await expect(client.getCurrentSession()).resolves.toBeDefined();
    clock += 2;
    expect(await rejection(client.getCurrentSession())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('refreshes with the refresh cookie: a new access expiry, a new CSRF token and a rotated refresh token', async () => {
    const first = await signIn();
    const before = JSON.parse(storage.getItem('hk-stub:cookies') ?? '{}');
    clock += ACCESS_TTL_MS + 1000; // the access cookie is gone by now
    const next = await client.refreshSession();
    const after = JSON.parse(storage.getItem('hk-stub:cookies') ?? '{}');
    expect(next.sessionId).toBe(first.sessionId);
    expect(next.csrfToken).not.toBe(first.csrfToken);
    expect(Date.parse(next.accessExpiresAt)).toBe(clock + ACCESS_TTL_MS);
    expect(after.rt.value).not.toBe(before.rt.value);
    expect(after.at.value).not.toBe(before.at.value);
    await expect(client.getCurrentSession()).resolves.toBeDefined();
  });

  it('keeps the same absolute refresh deadline across rotations', async () => {
    const first = await signIn();
    clock += 5 * 60_000;
    const next = await client.refreshSession();
    expect(next.refreshExpiresAt).toBe(first.refreshExpiresAt);
  });

  it('revokes the whole session when a rotated refresh token is presented again', async () => {
    await signIn();
    const stale = storage.getItem('hk-stub:cookies') ?? '';
    await client.refreshSession(); // rotates
    storage.setItem('hk-stub:cookies', stale); // a copied, already-used token
    expect(await rejection(client.refreshSession())).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    // The legitimate holder of the newest token is out as well.
    storage.setItem(
      'hk-stub:cookies',
      JSON.stringify({ at: { value: 'x', expires: clock + 1000 } }),
    );
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });

  it('answers 401 when there is no refresh cookie, and when the refresh lifetime has passed', async () => {
    expect((await rejection(client.refreshSession())).status).toBe(401);
    await signIn();
    clock += REFRESH_TTL_MS + 1;
    expect((await rejection(client.refreshSession())).status).toBe(401);
  });

  it('survives a reload: a new client over the same storage still has the session', async () => {
    const session = await signIn();
    const reloaded = createStubAuthClient({ now: () => clock, storage });
    expect((await reloaded.getCurrentSession()).sessionId).toBe(session.sessionId);
  });
});

describe('stub auth: logout and CSRF', () => {
  it('logs out with the CSRF token it was issued, clears the cookies and ends the session', async () => {
    await signIn();
    await client.logout();
    expect(JSON.parse(storage.getItem('hk-stub:cookies') ?? '{}')).toEqual({});
    expect((await rejection(client.getCurrentSession())).status).toBe(401);
  });

  it('refuses a state-changing call from a client that does not hold the current CSRF token', async () => {
    await signIn();
    const otherTab = createStubAuthClient({ now: () => clock, storage }); // has the cookies, not the token
    expect(await rejection(otherTab.logout())).toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_INVALID',
    });
  });
});

describe('stub auth: passwords', () => {
  it('changes the temporary password at first login, then accepts only the new one', async () => {
    await client.loginStaff(TEMP);
    await client.changePassword({
      currentPassword: TEMP.password,
      newPassword: 'A-much-longer-passphrase-9',
    });
    expect((await rejection(client.loginStaff(TEMP))).code).toBe('INVALID_CREDENTIALS');
    const result = await client.loginStaff({
      identifier: TEMP.identifier,
      password: 'A-much-longer-passphrase-9',
    });
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
          client.changePassword({
            currentPassword: 'wrong',
            newPassword: 'A-much-longer-passphrase-9',
          }),
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
      (
        await rejection(
          client.resetPassword({ token: 'wrong', newPassword: 'A-much-longer-passphrase-9' }),
        )
      ).status,
    ).toBe(422);
    await expect(
      client.resetPassword({ token: STUB_RESET_CODE, newPassword: 'A-much-longer-passphrase-9' }),
    ).resolves.toBeUndefined();
  });
});
