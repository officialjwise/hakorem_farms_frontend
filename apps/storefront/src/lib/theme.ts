import { cookies } from 'next/headers';

export type Theme = 'light' | 'dark' | 'system';
export const THEME_COOKIE = 'hk_theme';

/**
 * The reader's saved theme, from a cookie, so the server can put `data-theme` on <html> in the first byte
 * and the page never flashes the wrong theme (ADR 0015). No cookie means "follow the device": the generated
 * tokens switch on prefers-color-scheme when no `data-theme` is present.
 */
export async function readTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === 'light' || value === 'dark' ? value : 'system';
}
