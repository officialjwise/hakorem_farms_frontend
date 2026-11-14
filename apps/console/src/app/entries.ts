/**
 * The console is two documents (ADR 0030): `index.html` is the back office and `pos.html` is the till, each
 * with its own entry script, so the till never downloads the back office. This is the one rule for which
 * document a path belongs to. The dev and preview servers route by it (vite.config.ts), each document's
 * router hands a path it does not own to the other (OtherDocument), and a production host must do the
 * same: `/pos` and `/pos/...` serve `pos.html`, every other route serves `index.html`.
 *
 * The sign-in routes (`/login`, `/change-password` and the rest) belong to the back office document as
 * addresses, and both documents also render them in place, so a till that signs out and in again stays
 * on the till's code.
 */
export type ConsoleEntry = 'back-office' | 'pos';

/** `/pos` and anything under it, but not a file such as `/pos.html`. */
const POS_PATH = /^\/pos(?:\/[^.]*)?$/;

export function entryFor(pathname: string): ConsoleEntry {
  return POS_PATH.test(pathname) ? 'pos' : 'back-office';
}

/** The HTML file that serves each entry, relative to the build output. */
export const ENTRY_DOCUMENT: Record<ConsoleEntry, string> = {
  'back-office': 'index.html',
  pos: 'pos.html',
};
