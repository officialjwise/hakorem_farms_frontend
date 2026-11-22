/**
 * The console is three documents (ADR 0030, ADR 0058): `index.html` is the back office, `pos.html` the till
 * and `investor.html` the investor portal, each with its own entry script, so the till and an investor never
 * download the back office. This is the one rule for which
 * document a path belongs to. The dev and preview servers route by it (vite.config.ts), each document's
 * router hands a path it does not own to the other (OtherDocument), and a production host must do the
 * same: `/pos` and `/pos/...` serve `pos.html`, `/investor` and `/investor/...` serve `investor.html`, every
 * other route serves `index.html`.
 *
 * The sign-in routes (`/login`, `/change-password` and the rest) belong to the back office document as
 * addresses, and both documents also render them in place, so a till that signs out and in again stays
 * on the till's code.
 */
import type { Namespace } from '@hakorem/i18n';

export type ConsoleEntry = 'back-office' | 'pos' | 'investor';

/** `/pos` and anything under it, but not a file such as `/pos.html`. */
const POS_PATH = /^\/pos(?:\/[^.]*)?$/;
/** `/investor` and anything under it, the investor portal (ADR 0058), but not a file. */
const INVESTOR_PATH = /^\/investor(?:\/[^.]*)?$/;

export function entryFor(pathname: string): ConsoleEntry {
  if (POS_PATH.test(pathname)) return 'pos';
  if (INVESTOR_PATH.test(pathname)) return 'investor';
  return 'back-office';
}

/** The investor portal's router base (ADR 0058): its routes, sign-in included, sit under it. */
export const INVESTOR_BASENAME = '/investor';

/** The HTML file that serves each entry, relative to the build output. */
export const ENTRY_DOCUMENT: Record<ConsoleEntry, string> = {
  'back-office': 'index.html',
  pos: 'pos.html',
  investor: 'investor.html',
};

/**
 * The catalogue namespaces each document loads at boot, before its first screen renders. The till's are
 * the ones its shell, sign-in and sale screen use; it loads the refusal words and the shift screens' words
 * once its sale screen is up (`preloadTillScreens`). `pnpm budget:console` counts these in the initial load.
 */
export const ENTRY_NAMESPACES: Record<ConsoleEntry, Namespace[]> = {
  'back-office': ['common', 'shell', 'auth', 'iam', 'audit', 'refusals'],
  pos: ['common', 'shell', 'auth', 'pos'],
  investor: ['common', 'shell', 'auth', 'investor'],
};
