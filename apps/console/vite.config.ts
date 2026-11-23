import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { ENTRY_DOCUMENT, entryFor } from './src/app/entries.ts';
import { INVESTOR_DOCUMENT } from './src/investor/entry.ts';
import { assertShopUrlSet } from './src/lib/shopAddress.ts';
import { assertSwitchesAllowed } from './src/requested/switch.ts';
import { buildDefines, mockProxy, STAFF_COOKIE } from './vite.shared.ts';

/** The console's hosts hold the staff cookie only (ADR 0058): the portal is its own build and host. */
const consoleMockProxy = mockProxy(STAFF_COOKIE);

/**
 * Two documents, two entries (ADR 0030): index.html is the back office and pos.html is the till. The dev
 * and preview servers serve pos.html for `/pos` and `/pos/...`, by the same rule the routers use
 * (`entryFor`); everything else falls back to index.html as before. A production host needs the same
 * rewrite.
 */
const routeToEntryDocument: Connect.NextHandleFunction = (request, _response, next) => {
  const url = new URL(request.url ?? '/', 'http://console.local');
  // The investor portal's document sits beside these in the source tree, but it is its own build and
  // host (ADR 0058): the console's dev server never serves it either.
  if (url.pathname === `/${INVESTOR_DOCUMENT}`) request.url = `/${ENTRY_DOCUMENT['back-office']}`;
  const entry = entryFor(url.pathname);
  if (entry !== 'back-office') request.url = `/${ENTRY_DOCUMENT[entry]}${url.search}`;
  next();
};
const entryDocuments: Plugin = {
  name: 'hakorem-entry-documents',
  configureServer: (server) => void server.middlewares.use(routeToEntryDocument),
  configurePreviewServer: (server) => void server.middlewares.use(routeToEntryDocument),
};
const input = {
  main: fileURLToPath(new URL(`./${ENTRY_DOCUMENT['back-office']}`, import.meta.url)),
  pos: fileURLToPath(new URL(`./${ENTRY_DOCUMENT.pos}`, import.meta.url)),
};

export default defineConfig(({ mode, isPreview }) => {
  // HK_API_BASE_URL is the one variable that decides mock or real API (ADR 0019). The literal
  // `process.env.HK_API_BASE_URL` in @hakorem/api-client is replaced here, at build time.
  const env = loadEnv(mode, process.cwd(), '');
  // A switch may be on only in a build against the mock (ADR 0046, the owner's condition): fail here, before
  // anything is built, rather than ship a console that calls what the API lacks.
  if (mode !== 'test') assertSwitchesAllowed(env['HK_REQUESTED_CONTRACT'], env['HK_API_BASE_URL']);
  // The shop's address for the links the console hands a customer (ADR 0056): a build for a real API
  // fails without it, because a quote's link is answered once and would be lost.
  // `vite preview` only serves a finished build, which was checked when it was built.
  if (mode !== 'test' && isPreview !== true) {
    assertShopUrlSet(env['HK_SHOP_URL'], env['HK_API_BASE_URL']);
  }
  return {
    plugins: [react(), tailwindcss(), entryDocuments],
    // HK_REQUESTED_CONTRACT names the contract requests this build is built against (ADR 0046): the
    // end-to-end build's fake server answers them; a build for a real API leaves it unset.
    define: buildDefines(env, mode),
    build: {
      sourcemap: true,
      // dist/.vite/manifest.json: the chunk graph `pnpm budget:console` reads to tell a document's initial
      // load from what it loads on demand. It names only files the documents already link to.
      manifest: true,
      rolldownOptions: {
        input,
        // The code both documents load is one chunk, named for what it is rather than for whichever
        // module the bundler met first.
        output: {
          chunkFileNames: (chunk) =>
            chunk.isDynamicEntry ? 'assets/[name]-[hash].js' : 'assets/shared-[hash].js',
          assetFileNames: (asset) =>
            asset.names.some((name) => name.endsWith('.css'))
              ? 'assets/styles-[hash][extname]'
              : 'assets/[name]-[hash][extname]',
        },
      },
      // Vite's default 500 kB warning is not this console's budget. The budget is per document, gzipped,
      // in docs/PERFORMANCE_BUDGET.md, and `pnpm budget:console` fails when a document goes over it.
      chunkSizeWarningLimit: Number.POSITIVE_INFINITY,
    },
    server: { proxy: consoleMockProxy },
    preview: { proxy: consoleMockProxy },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['src/**/*.integration.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
