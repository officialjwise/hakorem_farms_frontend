import { describe, expect, it } from 'vitest';
import pos from '../../../../packages/i18n/locales/en/pos.json';
import posScreens from '../../../../packages/i18n/locales/en/posScreens.json';
import shell from '../../../../packages/i18n/locales/en/shell.json';
import { TILL_NAMESPACES } from '../pos/routes';
import { ENTRY_NAMESPACES } from './entries';

/**
 * The till's first load (F10q, the owner on 2026-11-25: at least 10 kB free before the next sale-screen
 * feature). The words only the till's on-demand screens read, and the back office's navigation, stay out of
 * what the till loads at boot; `pnpm budget:console` measures the rest.
 */
describe("the till's first load holds only the sale screen's words", () => {
  it('fetches the on-demand screens’ words with those screens, never at boot', () => {
    expect(TILL_NAMESPACES).toContain('posScreens');
    expect(ENTRY_NAMESPACES.pos).not.toContain('posScreens');
    for (const group of ['queue', 'returns', 'lock', 'setup', 'printer', 'digital']) {
      expect(Object.keys(posScreens)).toContain(group);
      expect(Object.keys(pos)).not.toContain(group);
    }
  });

  it('leaves the back office’s navigation words to the back office', () => {
    expect(ENTRY_NAMESPACES.pos).not.toContain('nav');
    expect(ENTRY_NAMESPACES['back-office']).toContain('nav');
    expect(Object.keys(shell)).not.toContain('nav');
  });
});
