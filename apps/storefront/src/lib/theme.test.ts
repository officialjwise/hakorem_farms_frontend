import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'hk_theme' && cookieValue.current ? { value: cookieValue.current } : undefined,
  }),
}));

import { readTheme } from './theme';

beforeEach(() => {
  cookieValue.current = undefined;
});

describe('readTheme (server-side data-theme, ADR 0015)', () => {
  it('follows the device when there is no cookie', async () => {
    expect(await readTheme()).toBe('system');
  });

  it('returns the saved light or dark theme', async () => {
    cookieValue.current = 'dark';
    expect(await readTheme()).toBe('dark');
    cookieValue.current = 'light';
    expect(await readTheme()).toBe('light');
  });

  it('ignores any other value, so a crafted cookie cannot put arbitrary text on <html>', async () => {
    cookieValue.current = '"><script>';
    expect(await readTheme()).toBe('system');
  });
});
