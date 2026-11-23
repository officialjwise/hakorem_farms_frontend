/**
 * The console is two documents (ADR 0030): `index.html` is the back office and `pos.html` the till, each
 * with its own entry script, so the till never downloads the back office. This is the one rule for which
 * document a path belongs to. The dev and preview servers route by it (vite.config.ts), each document's
 * router hands a path it does not own to the other (OtherDocument), and a production host must do the
 * same: `/pos` and `/pos/...` serve `pos.html`, every other route serves `index.html`.
 *
 * The investor portal is not one of them: it is its own build, on its own host (ADR 0058,
 * `vite.investor.config.ts`), and the console's address never serves it.
 *
 * The sign-in routes (`/login`, `/change-password` and the rest) belong to the back office document as
 * addresses, and both documents also render them in place, so a till that signs out and in again stays
 * on the till's code.
 */
import type { Namespace } from '@hakorem/i18n';

export type ConsoleEntry = 'back-office' | 'pos';

/** `/pos` and anything under it, but not a file such as `/pos.html`. */
const POS_PATH = /^\/pos(?:\/[^.]*)?$/;

export function entryFor(pathname: string): ConsoleEntry {
  if (POS_PATH.test(pathname)) return 'pos';
  return 'back-office';
}

/** The HTML file that serves each entry, relative to the build output. */
export const ENTRY_DOCUMENT: Record<ConsoleEntry, string> = {
  'back-office': 'index.html',
  pos: 'pos.html',
};

/**
 * The catalogue namespaces each document loads at boot, before its first screen renders. The till's are
 * the ones its shell, sign-in and sale screen use; it loads the refusal words and the shift screens' words
 * once its sale screen is up (`preloadTillScreens`). `pnpm budget:console` counts these in the initial load.
 */
export const ENTRY_NAMESPACES: Record<ConsoleEntry, Namespace[]> = {
  'back-office': ['common', 'shell', 'auth', 'iam', 'audit', 'refusals'],
  pos: ['common', 'shell', 'auth', 'pos'],
};
