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
import { operationManifest } from '@hakorem/api-client';
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

/** A permission code as `x-permission` writes one (`iam.user.read`), not a sentence about one. */
const PERMISSION_CODE = /^[a-z]+(\.[a-z_]+)+$/;

export type Outcome = 'fake' | 'prism' | 'prism-401' | 'prism-403' | 'step-up-403';

export class FakeApi {
  readonly server: FakeAuthServer = createFakeAuthServer();
  /** This browser's cookies for the API. */
  readonly jar: CookieJar = {};
  /** Every request seen, in order, and what answered it. */
  readonly log: { method: string; path: string; operationId: string | null; outcome: Outcome }[] =
    [];

  private readonly rewrites = new Map<string, (body: unknown, path: string) => unknown>();
  private readonly prefers = new Map<string, string>();

  /**
   * Rewrites Prism's answer to one operation for this test only, for a state the contract's single
   * example cannot show (for example a draft whose prices differ from the version in force).
   */
  rewrite(operationId: string, change: (body: unknown, path: string) => unknown): void {
    this.rewrites.set(operationId, change);
  }

  /** Asks Prism for one of the operation's own documented answers, for example `code=202`. */
  prefer(operationId: string, value: string): void {
    this.prefers.set(operationId, value);
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
    if (needed !== null && PERMISSION_CODE.test(needed) && !session.permissions.includes(needed)) {
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
}
