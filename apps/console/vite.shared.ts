import type { ProxyOptions } from 'vite';

/**
 * What the console's build (vite.config.ts) and the investor portal's (vite.investor.config.ts) share.
 *
 * The Prism mock in a browser (ADR 0025). Prism answers a credentialed cross-origin request properly, but
 * the contract describes no Set-Cookie, so a browser never holds the session cookie Prism's security check
 * looks for, and every operation behind it answers 401. This same-origin path forwards to `pnpm dev:mock`
 * and adds that cookie when the request has none. It only exists on Vite's dev and preview servers.
 *
 * Each build adds only its own host's cookie (ADR 0058): the console the staff cookie, the portal the
 * investor's, as each host holds only its own in production.
 *
 * It decides nothing: a build talks to it only when HK_API_BASE_URL is `/mock` (ADR 0019).
 */
export const MOCK_PATH = '/mock';
const PRISM = 'http://127.0.0.1:4010';

/** The staff session cookie, host-only on the console's host. */
export const STAFF_COOKIE = '__Host-hk_s_at';
/** The investor session cookie, host-only on the investor portal's host (ADR 0058). */
export const INVESTOR_COOKIE = '__Host-hk_i_at';

export function mockProxy(cookieName: string): Record<string, ProxyOptions> {
  return {
    [`^${MOCK_PATH}(/|$)`]: {
      target: PRISM,
      changeOrigin: true,
      rewrite: (path) => path.slice(MOCK_PATH.length) || '/',
      configure: (proxy) => {
        proxy.on('proxyReq', (request) => {
          const cookie = String(request.getHeader('cookie') ?? '');
          if (!cookie.includes(`${cookieName}=`)) {
            request.setHeader('cookie', `${cookieName}=dev-mock${cookie ? `; ${cookie}` : ''}`);
          }
        });
      },
    },
  };
}

/**
 * The build-time values both builds replace (ADR 0019, ADR 0046, ADR 0056). HK_API_BASE_URL is the one
 * variable that decides mock or real API; the literal `process.env.HK_API_BASE_URL` in @hakorem/api-client
 * is replaced here. Unit tests (mode `test`) read the others live, so a test can switch a request on.
 */
export function buildDefines(env: Record<string, string>, mode: string): Record<string, string> {
  return {
    'process.env.HK_API_BASE_URL': JSON.stringify(env['HK_API_BASE_URL'] ?? ''),
    ...(mode === 'test'
      ? {}
      : {
          'process.env.HK_REQUESTED_CONTRACT': JSON.stringify(env['HK_REQUESTED_CONTRACT'] ?? ''),
          'process.env.HK_SHOP_URL': JSON.stringify(env['HK_SHOP_URL'] ?? ''),
        }),
  };
}
