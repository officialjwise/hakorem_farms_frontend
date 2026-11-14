import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, parseApiBaseUrl } from './baseUrl';

describe('the API base URL (the one place that decides mock or real)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the Prism mock, a real /v1 URL and a same-origin path', () => {
    expect(parseApiBaseUrl('http://127.0.0.1:4010')).toBe('http://127.0.0.1:4010');
    expect(parseApiBaseUrl('https://api.hakoremfarms.com/v1')).toBe(
      'https://api.hakoremfarms.com/v1',
    );
    expect(parseApiBaseUrl('/mock')).toBe('/mock');
  });

  it('drops trailing slashes so a path never gets a double slash', () => {
    expect(parseApiBaseUrl('https://api.hakoremfarms.com/v1/')).toBe(
      'https://api.hakoremfarms.com/v1',
    );
  });

  it('refuses an unset or malformed value and names the variable', () => {
    expect(() => parseApiBaseUrl(undefined)).toThrow(/HK_API_BASE_URL is not set/);
    expect(() => parseApiBaseUrl('   ')).toThrow(/HK_API_BASE_URL is not set/);
    expect(() => parseApiBaseUrl('not a url')).toThrow(/HK_API_BASE_URL is not a URL/);
  });

  it('reads HK_API_BASE_URL from the environment and nothing else', () => {
    vi.stubEnv('HK_API_BASE_URL', 'http://127.0.0.1:4010');
    vi.stubEnv('NODE_ENV', 'production');
    expect(apiBaseUrl()).toBe('http://127.0.0.1:4010');
    vi.stubEnv('HK_API_BASE_URL', '');
    expect(() => apiBaseUrl()).toThrow(/not set/);
  });
});
