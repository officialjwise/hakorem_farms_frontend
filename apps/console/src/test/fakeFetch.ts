/**
 * The real auth client (ADR 0024) over a fetch that answers from the fake auth server (ADR 0026). Unit
 * tests use this in place of the F1 stub: the code under test is the client the app ships, and only the
 * network is a stand-in. Test support only.
 */
import { createApiAuthClient } from '../auth/apiAuthClient';
import type { AuthClient } from '../auth/types';
import {
  createFakeAuthServer,
  type CookieJar,
  type FakeAuthServer,
  type FakeResponse,
} from './fakeAuthServer';

export const FAKE_BASE_URL = 'http://api.test';

/** Turns the fake's answer into a fetch Response. An empty answer says so in Content-Length. */
export function toResponse(answer: FakeResponse): Response {
  const empty = answer.body === undefined;
  return new Response(empty ? null : JSON.stringify(answer.body), {
    status: answer.status,
    headers: { ...(answer.headers ?? {}), ...(empty ? { 'Content-Length': '0' } : {}) },
  });
}

/** A fetch for one browser: its own cookie jar, the shared fake server. Anything not auth fails loudly. */
export function fakeFetch(server: FakeAuthServer, jar: CookieJar) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const text = await request.text();
    const answer = server.handle(
      {
        method: request.method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers.entries()),
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      },
      jar,
    );
    if (answer === null)
      throw new Error(`fakeFetch: no fake for ${request.method} ${url.pathname}`);
    return toResponse(answer);
  };
}

export interface FakeBrowser {
  client: AuthClient;
  server: FakeAuthServer;
  jar: CookieJar;
}

/**
 * A browser on the fake server, running the real auth client. Pass the same `server` and `jar` again to
 * model a reload: a new client, the same cookies.
 */
export function fakeBrowser(
  options: { server?: FakeAuthServer; jar?: CookieJar } = {},
): FakeBrowser {
  const server = options.server ?? createFakeAuthServer();
  const jar = options.jar ?? {};
  const client = createApiAuthClient({ baseUrl: FAKE_BASE_URL, fetch: fakeFetch(server, jar) });
  return { client, server, jar };
}
