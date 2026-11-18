/**
 * The API as the end-to-end suite sees it (ADR 0026). The console build under test talks to `/mock`
 * (`HK_API_BASE_URL=/mock`, ADR 0025), and every request to it comes through here first:
 *
 * 1. **The eight auth operations** are answered by the fake auth server, the same one the console's unit
 *    tests use (`apps/console/src/test/fakeAuthServer.ts`). It keeps sessions, rotation, lockout, TOTP and
 *    CSRF, which Prism cannot, because Prism keeps no state.
 * 2. **Any other operation** is found in the generated `operationManifest` by method and path, then:
 *    - public: sent on to Prism;
 *    - no live session behind this browser's cookies: Prism with `Prefer: code=401`, so the contract's own
 *      401 comes back;
 *    - the session lacks the operation's `x-permission`: Prism with `Prefer: code=403`, the contract's own 403;
 *    - the operation needs step-up and the session has none in the last five minutes: the fake's own 403
 *      `STEP_UP_REQUIRED` (API.md 3.4), because step-up is session state Prism does not keep;
 *    - otherwise: on to Prism through the `/mock` proxy, which answers from the contract's examples.
 *      Prism's lists never end: every page says `hasMore: true` with the SAME `nextCursor`, whatever cursor
 *      it was asked with. A page whose `nextCursor` is the cursor it was asked with comes back as the last
 *      page, or `useApiAllPages` would meet its hard cap on every read (ADR 0028). The integration
 *      tests' harness does the same.
 *
 * The cookie jar is the fake's, one per browser context, so nothing depends on how Chromium treats a
 * Set-Cookie on a fulfilled response. A reload keeps it; a new context starts empty, like a new browser.
 */
import { operationManifest, type RequestedOperation } from '@hakorem/api-client';
import type { BrowserContext, Page, Route } from '@playwright/test';
import {
  createFakeAuthServer,
  type CookieJar,
  type FakeAuthServer,
} from '../../apps/console/src/test/fakeAuthServer';

/** The same-origin path the e2e build's HK_API_BASE_URL names. */
export const API_PATH = '/mock';

interface Operation {
  id: string;
  method: string;
  pattern: RegExp;
  /** Path parameters in the template: fewer is a more literal match. */
  params: number;
  permission: string | null;
  public: boolean;
}

const OPERATIONS: Operation[] = Object.entries(operationManifest).map(([id, row]) => ({
  id,
  method: row.method.toUpperCase(),
  pattern: new RegExp(`^${row.path.replace(/\{[^}]+\}/g, '[^/]+')}$`),
  params: (row.path.match(/\{/g) ?? []).length,
  permission: row.permission,
  public: row.public,
}));

/** The operation a request is for. `/iam/users/me`-style literals beat `{id}` templates. */
export function findOperation(method: string, path: string): Operation | undefined {
  return OPERATIONS.filter((op) => op.method === method && op.pattern.test(path)).sort(
    (a, b) => a.params - b.params,
  )[0];
}

/**
 * Operations whose description grants a second permission besides `x-permission`. `uploadFile` takes
 * `platform.file.upload.evidence` for an `EVIDENCE` file (1.31.0, the Farm hand). The fake does not read
 * the multipart body, so it lets that holder through for any purpose; the console only asks it for
 * evidence.
 */
const ALTERNATIVE_PERMISSIONS: Record<string, readonly string[]> = {
  uploadFile: ['platform.file.upload.evidence'],
};

/** A permission code as `x-permission` writes one (`iam.user.read`), not a sentence about one. */
const PERMISSION_CODE = /^[a-z]+(\.[a-z_]+)+$/;

export type Outcome =
  | 'fake'
  | 'prism'
  | 'prism-401'
  | 'prism-403'
  | 'step-up-403'
  | 'requested'
  | 'requested-401'
  | 'requested-403';

export class FakeApi {
  readonly server: FakeAuthServer = createFakeAuthServer();
  /** This browser's cookies for the API. */
  readonly jar: CookieJar = {};
  /** Every request seen, in order, and what answered it. */
  readonly log: { method: string; path: string; operationId: string | null; outcome: Outcome }[] =
    [];

  private readonly rewrites = new Map<string, (body: unknown, path: string) => unknown>();
  private readonly responders = new Map<string, (request: unknown, path: string) => unknown>();
  private readonly losing = new Set<string>();
  private networkOff = false;

  /**
   * Turns this browser's network off or on (F9). Playwright's offline mode still lets a request reach a
   * route handler, so the fake would answer it; with the network off every API request fails here as it
   * would on a dead connection, before anything is answered. `context.setOffline` is set too, so the
   * browser says it is offline and files fail to load.
   */
  async setNetwork(context: BrowserContext, on: boolean): Promise<void> {
    this.networkOff = !on;
    await context.setOffline(!on);
  }

  /** The next answer to this operation is lost after the server acted on it: the connection resets. */
  loseNextAnswer(operationId: string): void {
    this.losing.add(operationId);
  }
  private readonly requested: {
    operation: RequestedOperation;
    pattern: RegExp;
    answer: (request: unknown, path: string) => unknown;
    status: number;
  }[] = [];
  private readonly prefers = new Map<string, string>();
  private readonly refusals = new Map<string, { status: number; code: string; message: string }>();

  /**
   * Rewrites Prism's answer to one operation for this test only, for a state the contract's single
   * example cannot show (for example a draft whose prices differ from the version in force).
   */
  rewrite(operationId: string, change: (body: unknown, path: string) => unknown): void {
    this.rewrites.set(operationId, change);
  }

  /**
   * Answers one operation from the request it received, after the same session and permission checks, for
   * an answer that depends on what was sent: `syncOfflineSales` answering for the sale ids the till sent,
   * as the server does (the contract's example names other sales). The answer must be the contract's shape.
   */
  respond(operationId: string, answer: (request: unknown, path: string) => unknown): void {
    if (!(operationId in operationManifest))
      throw new Error(`${operationId} is not in the contract.`);
    this.responders.set(operationId, answer);
  }

  /**
   * Answers an operation a contract request asks for and the contract does not list yet (ADR 0046), in the
   * requested shape, after the same session and permission checks as every other operation. Prism does
   * not know it, so with no answer installed the request is Prism's 404, as a real API without it would be.
   */
  respondRequested(
    operation: RequestedOperation,
    answer: (request: unknown, path: string) => unknown,
    /** The answer's status: 200, or 202 for a write that waits for a second person (CR-047's override). */
    status = 200,
  ): void {
    if (operation.operationId in operationManifest) {
      throw new Error(`${operation.operationId} is in the contract now: use respond().`);
    }
    const pattern = new RegExp(`^${operation.path.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    this.requested.push({ operation, pattern, answer, status });
  }

  /** Asks Prism for one of the operation's own documented answers, for example `code=202`. */
  prefer(operationId: string, value: string): void {
    this.prefers.set(operationId, value);
  }

  /**
   * Answers one operation with the contract's error envelope for a code it lists in `x-error-codes`, when
   * none of its examples carries that code: for example `approveRequest` refusing the maker
   * (MAKER_CANNOT_CHECK). The test names the code; the screen's words are its own (ADR 0038).
   */
  refuse(operationId: string, status: number, code: string, message: string): void {
    const manifest = operationManifest[operationId as keyof typeof operationManifest];
    if (manifest === undefined) throw new Error(`${operationId} is not in the contract.`);
    this.refusals.set(operationId, { status, code, message });
  }

  async install(context: BrowserContext): Promise<void> {
    await context.route(`**${API_PATH}/**`, (route) => this.answer(route));
  }

  /** Starts Playwright's clock and the fake's together, at the same instant. */
  async installClock(page: Page, time: Date): Promise<void> {
    await page.clock.install({ time });
    this.server.clock.set(time.getTime());
  }

  /** Jumps both clocks. The server's moves first, so a timer the jump fires is answered at the new time. */
  async fastForward(page: Page, ms: number): Promise<void> {
    this.server.clock.advance(ms);
    await page.clock.fastForward(ms);
  }

  private async answer(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith(`${API_PATH}/`)) return route.continue();
    if (this.networkOff) return route.abort('internetdisconnected');
    const path = url.pathname.slice(API_PATH.length);
    const method = request.method();
    // A file upload (multipart/form-data) is not the fake's business and is not JSON: only JSON is parsed.
    const isJson = (request.headers()['content-type'] ?? '').startsWith('application/json');
    const text = isJson ? (request.postData() ?? '') : '';

    const answer = this.server.handle(
      {
        method,
        path,
        headers: await request.allHeaders(),
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      },
      this.jar,
    );
    if (answer !== null) {
      this.log.push({ method, path, operationId: null, outcome: 'fake' });
      return route.fulfill({
        status: answer.status,
        headers: answer.headers ?? {},
        body: answer.body === undefined ? '' : JSON.stringify(answer.body),
      });
    }

    const requested = this.requested.find(
      (r) => r.operation.method.toUpperCase() === method && r.pattern.test(path),
    );
    if (requested !== undefined) return this.answerRequested(route, requested, path, text);

    const operation = findOperation(method, path);
    const record = (outcome: Outcome) =>
      this.log.push({ method, path, operationId: operation?.id ?? null, outcome });
    if (operation === undefined || operation.public) {
      record('prism');
      return route.continue();
    }
    const session = this.server.sessionFor(this.jar);
    if (session === null) {
      record('prism-401');
      return route.continue({ headers: { ...request.headers(), prefer: 'code=401' } });
    }
    const needed = operation.permission;
    const alternatives = ALTERNATIVE_PERMISSIONS[operation.id] ?? [];
    const holds = (code: string) => session.permissions.includes(code);
    if (
      needed !== null &&
      PERMISSION_CODE.test(needed) &&
      !holds(needed) &&
      !alternatives.some(holds)
    ) {
      record('prism-403');
      return route.continue({ headers: { ...request.headers(), prefer: 'code=403' } });
    }
    const refusal = this.server.stepUpRefusal(this.jar, operation.id);
    if (refusal !== null) {
      record('step-up-403');
      return route.fulfill({
        status: refusal.status,
        headers: refusal.headers ?? {},
        body: JSON.stringify(refusal.body),
      });
    }
    const refused = this.refusals.get(operation.id);
    if (refused !== undefined) {
      record('prism');
      return route.fulfill({
        status: refused.status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: refused.code,
            message: refused.message,
            correlationId: '019a7b1d-5a33-73ab-98e3-438b35eabc69',
            details: [],
          },
        }),
      });
    }
    const responder = this.responders.get(operation.id);
    if (responder !== undefined) {
      record('prism');
      const body = JSON.stringify(
        responder(text === '' ? null : (JSON.parse(text) as unknown), path),
      );
      if (this.losing.delete(operation.id)) return route.abort('connectionreset');
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
    record('prism');
    const preferred = operation === undefined ? undefined : this.prefers.get(operation.id);
    if (preferred !== undefined) {
      return route.continue({ headers: { ...request.headers(), prefer: preferred } });
    }
    const change = this.rewrites.get(operation.id);
    const cursor = url.searchParams.get('cursor');
    if (change === undefined && (method !== 'GET' || cursor === null)) return route.continue();
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    let body = (await response.json().catch(() => null)) as {
      page?: { nextCursor?: string | null; hasMore?: boolean };
    } | null;
    // Prism answers every page with the same cursor: the page asked for with it is the last one.
    if (cursor !== null && body?.page?.nextCursor === cursor) {
      body = { ...body, page: { ...body.page, nextCursor: null, hasMore: false } };
    }
    return route.fulfill({ response, json: change === undefined ? body : change(body, path) });
  }

  private async answerRequested(
    route: Route,
    requested: FakeApi['requested'][number],
    path: string,
    text: string,
  ): Promise<void> {
    const { operation } = requested;
    const method = operation.method.toUpperCase();
    const refuse = (status: number, code: string, outcome: Outcome) => {
      this.log.push({ method, path, operationId: operation.operationId, outcome });
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code,
            message: 'Refused.',
            correlationId: '019a7b1d-5a33-73ab-98e3-438b35eabc69',
            details: [],
          },
        }),
      });
    };
    if (!operation.public) {
      const session = this.server.sessionFor(this.jar);
      if (session === null) return refuse(401, 'UNAUTHENTICATED', 'requested-401');
      if (operation.permission !== null && !session.permissions.includes(operation.permission)) {
        return refuse(403, 'FORBIDDEN', 'requested-403');
      }
      if (operation.device && route.request().headers()['x-device-credential'] === undefined) {
        return refuse(401, 'DEVICE_CREDENTIAL_INVALID', 'requested-401');
      }
    }
    this.log.push({ method, path, operationId: operation.operationId, outcome: 'requested' });
    const body = requested.answer(text === '' ? null : (JSON.parse(text) as unknown), path);
    return route.fulfill({
      status: requested.status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  }
}
