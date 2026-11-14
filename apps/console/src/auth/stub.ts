/**
 * The stub auth module (ADR 0012). It stands in for the real API until F3 and mimics what contract 1.1.0
 * says about staff authentication:
 *
 * - Cookies `__Host-hk_s_at` (access, 10 minutes) and `__Host-hk_s_rt` (refresh) are set by loginStaff and
 *   verifyTotp. They are HttpOnly in the real thing, so nothing outside this file ever reads them. Here they
 *   live in a simulated cookie jar, and an expired cookie is dropped, as a browser would.
 * - refreshSession rotates the refresh cookie. Presenting an already-rotated token revokes the whole session.
 * - Failed logins answer with one message (INVALID_CREDENTIALS) and back off (429 RATE_LIMITED).
 * - A TOTP challenge is single use and short lived.
 * - changePassword and logout need the CSRF token that the last session response carried.
 *
 * The seed users are fixtures for development and tests. They are not secrets, and none of this file runs in
 * production once F3 swaps `client.ts` to the real client.
 */
import { ApiError, type AuthClient, type SessionInfo } from './types';

export const ACCESS_COOKIE = '__Host-hk_s_at';
export const REFRESH_COOKIE = '__Host-hk_s_rt';
export const ACCESS_TTL_MS = 10 * 60 * 1000;
export const REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 30 * 1000;
const MAX_TOTP_ATTEMPTS = 5;

/** The code the stub accepts for any user with TOTP. It is the contract's own example code. */
export const STUB_TOTP_CODE = '481205';
/** The reset code the stub accepts. Real codes arrive by SMS or email. */
export const STUB_RESET_CODE = '738204';

const BRANCH = {
  branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
  branchCode: 'DDW',
  locationId: null,
  locationCode: null,
} as const;

interface StubUser {
  id: string;
  displayName: string;
  password: string;
  totp: boolean;
  mustChangePassword: boolean;
  roleCode: string;
  roleName: string;
  permissions: string[];
}

const CASHIER_PERMISSIONS = [
  'pos.sale.create',
  'pos.shift.open',
  'pos.shift.close',
  'mdm.product.read',
  'inv.stock.read',
  'pay.payment.create',
  'ord.order.read',
];

/** Keyed by lower-case email. Permission codes are the contract's `x-permission` values. */
export const STUB_USERS: Record<string, StubUser> = {
  'kwabena.owusu@hakoremfarms.com': {
    id: '019a7a86-4f35-7afd-b035-b8ab03a83188',
    displayName: 'Kwabena Owusu',
    password: 'Mango-Season-2026!',
    totp: true,
    mustChangePassword: false,
    roleCode: 'MANAGER',
    roleName: 'Manager',
    permissions: [
      ...CASHIER_PERMISSIONS,
      'iam.user.read',
      'inv.adjustment.approve',
      'mdm.price_list.approve',
    ],
  },
  'adwoa.darko@hakoremfarms.com': {
    id: '019a7a86-ac02-78a8-ade0-935170bb0c2f',
    displayName: 'Adwoa Darko',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'CASHIER',
    roleName: 'Cashier',
    permissions: CASHIER_PERMISSIONS,
  },
  'yaw.boateng@hakoremfarms.com': {
    id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11',
    displayName: 'Yaw Boateng',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'STOREKEEPER',
    roleName: 'Storekeeper',
    permissions: ['inv.stock.read', 'mdm.product.read'],
  },
  'new.staff@hakoremfarms.com': {
    id: '019a7a86-9d07-7e52-a1c3-6a4f1d0c2b90',
    displayName: 'Efua Asante',
    password: 'Temp-8841-Farm',
    totp: false,
    mustChangePassword: true,
    roleCode: 'CASHIER',
    roleName: 'Cashier',
    permissions: CASHIER_PERMISSIONS,
  },
};

interface Cookie {
  value: string;
  expires: number;
}
interface Jar {
  at?: Cookie;
  rt?: Cookie;
}
interface ServerSession {
  email: string;
  access: string;
  refresh: string;
  rotated: string[];
  csrf: string;
  revoked: boolean;
  refreshExpires: number;
}
interface Challenge {
  email: string;
  kind: 'totp' | 'password';
  expires: number;
  attempts: number;
}
interface Server {
  sessions: Record<string, ServerSession>;
  challenges: Record<string, Challenge>;
  failures: Record<string, { count: number; until: number }>;
  passwords: Record<string, string>;
  /** The password-change challenge a loginStaff answered with, see CR-004. */
  pendingPasswordChange: string | null;
}

export interface StubOptions {
  /** Defaults to Date.now. Tests and Playwright's clock control it. */
  now?: () => number;
  /** Defaults to window.localStorage. The stub keeps its cookie jar and its fake server there so a reload survives, as cookies do. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Simulated network delay in milliseconds. */
  latencyMs?: number;
}

/** A copy of the record without one key. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function uuid(): string {
  return crypto.randomUUID();
}

function fail(status: number, code: string, message: string, retryAfter?: number): never {
  throw new ApiError({
    status,
    code,
    message,
    correlationId: uuid(),
    ...(retryAfter === undefined ? {} : { retryAfter }),
  });
}

export function createStubAuthClient(options: StubOptions = {}): AuthClient {
  const now = options.now ?? (() => Date.now());
  const store = options.storage ?? window.localStorage;
  const latency = options.latencyMs ?? 0;
  const JAR_KEY = 'hk-stub:cookies';
  const SERVER_KEY = 'hk-stub:server';
  /** Held in memory only: the CSRF token the last session response carried. */
  let csrf: string | null = null;

  const readJar = (): Jar => {
    const raw = store.getItem(JAR_KEY);
    const jar = raw === null ? {} : (JSON.parse(raw) as Jar);
    // A browser drops an expired cookie. Do the same.
    if (jar.at && jar.at.expires <= now()) delete jar.at;
    if (jar.rt && jar.rt.expires <= now()) delete jar.rt;
    return jar;
  };
  const writeJar = (jar: Jar) => store.setItem(JAR_KEY, JSON.stringify(jar));
  const readServer = (): Server => {
    const raw = store.getItem(SERVER_KEY);
    return raw === null
      ? { sessions: {}, challenges: {}, failures: {}, passwords: {}, pendingPasswordChange: null }
      : (JSON.parse(raw) as Server);
  };
  const writeServer = (server: Server) => store.setItem(SERVER_KEY, JSON.stringify(server));
  const wait = () =>
    latency > 0 ? new Promise<void>((resolve) => setTimeout(resolve, latency)) : Promise.resolve();

  const passwordOf = (server: Server, email: string): string | undefined =>
    server.passwords[email] ?? STUB_USERS[email]?.password;

  function startSession(server: Server, email: string): SessionInfo {
    const user = STUB_USERS[email];
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
    const sessionId = uuid();
    const session: ServerSession = {
      email,
      access: `at.${uuid()}`,
      refresh: `rt.${uuid()}`,
      rotated: [],
      csrf: uuid().replaceAll('-', ''),
      revoked: false,
      refreshExpires: now() + REFRESH_TTL_MS,
    };
    server.sessions[sessionId] = session;
    return issue(sessionId, session);
  }

  /** Sets both cookies and returns the SessionInfo body, as every session-issuing response does. */
  function issue(sessionId: string, session: ServerSession): SessionInfo {
    const user = STUB_USERS[session.email] as StubUser;
    const accessExpires = now() + ACCESS_TTL_MS;
    writeJar({
      at: { value: session.access, expires: accessExpires },
      rt: { value: session.refresh, expires: session.refreshExpires },
    });
    csrf = session.csrf;
    return {
      sessionId,
      realm: 'STAFF',
      principal: { id: user.id, displayName: user.displayName },
      csrfToken: session.csrf,
      accessExpiresAt: new Date(accessExpires).toISOString(),
      refreshExpiresAt: new Date(session.refreshExpires).toISOString(),
      steppedUpAt: null,
      mustChangePassword: false,
      totpEnrolled: user.totp,
      grants: [{ roleCode: user.roleCode, roleName: user.roleName, ...BRANCH }],
      permissions: [...user.permissions],
    };
  }

  /** The session the access cookie belongs to, or a 401. */
  function authenticate(server: Server): [string, ServerSession] {
    const at = readJar().at;
    if (!at) return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
    const entry = Object.entries(server.sessions).find(([, s]) => s.access === at.value);
    if (!entry || entry[1].revoked) return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
    return entry;
  }

  return {
    async loginStaff({ identifier, password }) {
      await wait();
      const server = readServer();
      const email = identifier.trim().toLowerCase();
      const failure = server.failures[email] ?? { count: 0, until: 0 };
      if (failure.until > now()) {
        fail(
          429,
          'RATE_LIMITED',
          'Too many attempts. Try again shortly.',
          Math.ceil((failure.until - now()) / 1000),
        );
      }
      const user = STUB_USERS[email];
      if (!user || passwordOf(server, email) !== password) {
        failure.count += 1;
        if (failure.count >= MAX_FAILURES) {
          failure.until = now() + LOCKOUT_MS;
          failure.count = 0;
        }
        server.failures[email] = failure;
        writeServer(server);
        return fail(
          401,
          'INVALID_CREDENTIALS',
          'The email, phone number or password is not right.',
        );
      }
      server.failures = without(server.failures, email);
      if (user.mustChangePassword && server.passwords[email] === undefined) {
        const token = `hk1.ch.${uuid()}`;
        server.challenges[token] = {
          email,
          kind: 'password',
          expires: now() + CHALLENGE_TTL_MS,
          attempts: 0,
        };
        server.pendingPasswordChange = token;
        writeServer(server);
        return { status: 'PASSWORD_CHANGE_REQUIRED', challengeToken: token, session: null };
      }
      if (user.totp) {
        const token = `hk1.ch.${uuid()}`;
        server.challenges[token] = {
          email,
          kind: 'totp',
          expires: now() + CHALLENGE_TTL_MS,
          attempts: 0,
        };
        writeServer(server);
        return { status: 'TOTP_REQUIRED', challengeToken: token, session: null };
      }
      const session = startSession(server, email);
      writeServer(server);
      return { status: 'AUTHENTICATED', challengeToken: null, session };
    },

    async verifyTotp({ challengeToken, code }) {
      await wait();
      const server = readServer();
      const challenge = server.challenges[challengeToken];
      if (!challenge || challenge.kind !== 'totp' || challenge.expires <= now()) {
        return fail(401, 'CHALLENGE_EXPIRED', 'That sign-in took too long. Start again.');
      }
      if (code.trim() !== STUB_TOTP_CODE) {
        challenge.attempts += 1;
        if (challenge.attempts >= MAX_TOTP_ATTEMPTS) {
          server.challenges = without(server.challenges, challengeToken);
        }
        writeServer(server);
        return fail(401, 'TOTP_INVALID', 'The code is wrong or already used.');
      }
      server.challenges = without(server.challenges, challengeToken);
      const session = startSession(server, challenge.email);
      writeServer(server);
      return { status: 'AUTHENTICATED', challengeToken: null, session };
    },

    async getCurrentSession() {
      await wait();
      const server = readServer();
      const [sessionId, session] = authenticate(server);
      return issueReadOnly(sessionId, session);
    },

    async refreshSession() {
      await wait();
      const server = readServer();
      const rt = readJar().rt;
      if (!rt) return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
      const entry = Object.entries(server.sessions).find(
        ([, s]) => s.refresh === rt.value || s.rotated.includes(rt.value),
      );
      if (!entry) return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
      const [sessionId, session] = entry;
      if (session.revoked || session.refreshExpires <= now()) {
        return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
      }
      if (session.rotated.includes(rt.value)) {
        // A refresh token that was already used: the whole session is revoked (contract, refreshSession).
        session.revoked = true;
        writeServer(server);
        return fail(401, 'UNAUTHENTICATED', 'Please log in again.');
      }
      session.rotated.push(session.refresh);
      session.refresh = `rt.${uuid()}`;
      session.access = `at.${uuid()}`;
      session.csrf = uuid().replaceAll('-', '');
      const info = issue(sessionId, session);
      writeServer(server);
      return info;
    },

    async logout() {
      await wait();
      const server = readServer();
      const [, session] = authenticate(server);
      if (csrf !== session.csrf)
        fail(403, 'CSRF_TOKEN_INVALID', 'The request could not be verified.');
      session.revoked = true;
      writeServer(server);
      writeJar({});
      csrf = null;
    },

    async changePassword({ currentPassword, newPassword }) {
      await wait();
      const server = readServer();
      let email: string;
      if (readJar().at) {
        const [, session] = authenticate(server);
        if (csrf !== session.csrf)
          fail(403, 'CSRF_TOKEN_INVALID', 'The request could not be verified.');
        email = session.email;
      } else {
        // CR-004: how the first-login change authenticates is not stated by the contract. The stub accepts the
        // challenge its own loginStaff answered with.
        const challenge = server.pendingPasswordChange
          ? server.challenges[server.pendingPasswordChange]
          : undefined;
        if (!challenge || challenge.expires <= now()) {
          return fail(401, 'CHALLENGE_EXPIRED', 'That sign-in took too long. Start again.');
        }
        email = challenge.email;
      }
      if (passwordOf(server, email) !== currentPassword) {
        return fail(
          401,
          'INVALID_CREDENTIALS',
          'The email, phone number or password is not right.',
        );
      }
      if (newPassword.length < 12) {
        throw new ApiError({
          status: 400,
          code: 'VALIDATION_FAILED',
          message: 'Some fields are not valid.',
          correlationId: uuid(),
          details: [
            {
              field: '/newPassword',
              code: 'MIN_LENGTH',
              message: 'The password needs at least 12 characters.',
            },
          ],
        });
      }
      if (/^(password|123456789012|qwertyuiop12)/i.test(newPassword)) {
        return fail(
          422,
          'PASSWORD_BREACHED',
          'That password appears in a list of breached passwords.',
        );
      }
      server.passwords[email] = newPassword;
      if (server.pendingPasswordChange) {
        server.challenges = without(server.challenges, server.pendingPasswordChange);
      }
      server.pendingPasswordChange = null;
      writeServer(server);
    },

    async requestPasswordReset() {
      await wait();
      // Always the same answer, whether or not the account exists (contract, requestPasswordReset).
    },

    async resetPassword({ token, newPassword }) {
      await wait();
      if (newPassword.length < 12) {
        throw new ApiError({
          status: 400,
          code: 'VALIDATION_FAILED',
          message: 'Some fields are not valid.',
          correlationId: uuid(),
          details: [
            {
              field: '/newPassword',
              code: 'MIN_LENGTH',
              message: 'The password needs at least 12 characters.',
            },
          ],
        });
      }
      // The stub accepts the code printed in the dev notes and refuses any other.
      if (token.trim() !== STUB_RESET_CODE) {
        // The contract names no code for an invalid reset code (CR-004); this one is the stub's own.
        return fail(422, 'RESET_CODE_INVALID', 'That reset code is not valid or has expired.');
      }
    },
  };

  /** getCurrentSession returns the current session without rotating anything. */
  function issueReadOnly(sessionId: string, session: ServerSession): SessionInfo {
    const user = STUB_USERS[session.email] as StubUser;
    const at = readJar().at as Cookie;
    return {
      sessionId,
      realm: 'STAFF',
      principal: { id: user.id, displayName: user.displayName },
      csrfToken: (csrf = session.csrf),
      accessExpiresAt: new Date(at.expires).toISOString(),
      refreshExpiresAt: new Date(session.refreshExpires).toISOString(),
      steppedUpAt: null,
      mustChangePassword: false,
      totpEnrolled: user.totp,
      grants: [{ roleCode: user.roleCode, roleName: user.roleName, ...BRANCH }],
      permissions: [...user.permissions],
    };
  }
}
