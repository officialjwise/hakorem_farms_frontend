/**
 * THE ONE PLACE that decides whether a build talks to the Prism mock or to a real API (ADR 0019).
 *
 * One environment variable, `HK_API_BASE_URL`, holds the base URL every request goes to:
 *
 *   http://127.0.0.1:4010                 the Prism mock (`pnpm dev:mock`)
 *   https://api.staging.hakoremfarms.com/v1   staging
 *   https://api.hakoremfarms.com/v1       production
 *   /mock                                 a same-origin path, for a dev proxy
 *
 * There is no "mock mode" flag, no NODE_ENV check and no default: an app that has not been told where the
 * API is says so the first time it needs it, instead of quietly talking to the wrong one. Vite and Next
 * both replace the literal `process.env.HK_API_BASE_URL` below at build time (see each app's config), so
 * the name is written out in full on purpose.
 */

export const API_BASE_URL_VARIABLE = 'HK_API_BASE_URL';

/** Turns a raw value into a base URL without a trailing slash, or throws a message that names the variable. */
export function parseApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (value === '') {
    throw new Error(
      `${API_BASE_URL_VARIABLE} is not set. Set it to the API base URL: http://127.0.0.1:4010 for the Prism mock (pnpm dev:mock), or the real API's /v1 URL.`,
    );
  }
  if (!value.startsWith('/')) {
    try {
      new URL(value);
    } catch {
      throw new Error(`${API_BASE_URL_VARIABLE} is not a URL or an absolute path: "${value}".`);
    }
  }
  return value.replace(/\/+$/, '');
}

/** The API base URL for this build. Throws if the variable is unset or malformed. */
export function apiBaseUrl(): string {
  return parseApiBaseUrl(process.env.HK_API_BASE_URL);
}
