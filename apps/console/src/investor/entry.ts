/**
 * The investor portal is its own build, served on its own host (ADR 0058, the owner on 2026-11-23): never
 * under the console's address, and with its own host-only session cookie, `__Host-hk_i_at`, set and sent
 * on the portal's host only. `vite.investor.config.ts` builds it from `investor.html` into
 * `dist-investor/`, and every address on that host that is not a file is answered with it. Its routes sit at
 * the root of that host: the summary is `/`, the sign-in `/login`.
 */
import type { Namespace } from '@hakorem/i18n';

/** The portal's one document, relative to its build output (`dist-investor/`). */
export const INVESTOR_DOCUMENT = 'investor.html';

/** The catalogue namespaces the portal loads at boot. `pnpm budget:console` counts them in its first load. */
export const INVESTOR_NAMESPACES: Namespace[] = ['common', 'shell', 'auth', 'investor'];
