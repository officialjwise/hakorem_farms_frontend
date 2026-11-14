# 0013. The console is an installable PWA with a manifest from the tokens and a service worker that caches nothing yet

- Status: accepted
- Date: 2026-11-14
- Session: F1

## Context

The console must be installable. Its caching strategy, offline queue and update flow are F13 work, and a wrong cache is worse than none: it can serve a stale POS shell during a sale.

## Options considered

1. **`vite-plugin-pwa` (Workbox).** Generates a service worker with precaching. It is the strategy decision F13 must make deliberately, and a new build-time dependency.
2. **A hand-written minimal service worker and a static manifest.**
3. **No service worker.** Chrome installs from a manifest alone on some platforms, but not reliably, and the POS needs the worker in F13 anyway.

## Decision

Option 2.

- `public/sw.js` installs, calls `skipWaiting`, claims clients, and has **no fetch handler and no cache**. It exists to make the app installable and to give F13 a registered worker to extend.
- It is registered only in production builds (`import.meta.env.PROD`), after load, and the registration copes with `load` having already fired.
- `public/manifest.webmanifest` and the icons are **generated** by `pnpm --filter @hakorem/console icons` from the colour tokens (`palette.ts`), so no hex lives in the app. The script draws an "H" on the accent colour as SVG and as PNG (192, 512 and a maskable 512) using only Node's `zlib`. `pnpm icons:check` fails CI if they are stale. Replace the glyph when a brand mark arrives.
- The manifest has a shortcut to `/pos`.
- Playwright checks the manifest fields, that every icon loads, and that the production build registers a worker.

## Consequences

- F13 replaces `sw.js` with a worker that has an explicit strategy per route class, an IndexedDB queue and an update flow that cannot lose an open sale.
- Until then the console needs the network to load. The POS shell's offline indicator and rules are real, but offline boot is F13.
