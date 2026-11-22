import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import type { Connect, Plugin, ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';
import { ENTRY_DOCUMENT, entryFor } from './src/app/entries.ts';
import { assertShopUrlSet } from './src/lib/shopAddress.ts';
import { assertSwitchesAllowed } from './src/requested/switch.ts';

/**
 * The Prism mock in a browser (ADR 0025). Prism answers a credentialed cross-origin request properly, but
 * the contract describes no Set-Cookie, so a browser never holds the staff cookie Prism's security check
 * looks for, and every staff operation answers 401. This same-origin path forwards to `pnpm dev:mock` and
 * adds that cookie when the request has none. It only exists on Vite's dev and preview servers.
 *
 * It decides nothing: a build talks to it only when HK_API_BASE_URL is `/mock` (ADR 0019).
 */
const MOCK_PATH = '/mock';
const PRISM = 'http://127.0.0.1:4010';
const STAFF_COOKIE = '__Host-hk_s_at';
/** The investor portal's cookie (ADR 0058), added beside the staff one for the investor operations. */
const INVESTOR_COOKIE = '__Host-hk_i_at';
const mockProxy: Record<string, ProxyOptions> = {
  [`^${MOCK_PATH}(/|$)`]: {
    target: PRISM,
    changeOrigin: true,
    rewrite: (path) => path.slice(MOCK_PATH.length) || '/',
    configure: (proxy) => {
      proxy.on('proxyReq', (request) => {
        const cookie = String(request.getHeader('cookie') ?? '');
        const missing = [STAFF_COOKIE, INVESTOR_COOKIE].filter(
          (name) => !cookie.includes(`${name}=`),
        );
        if (missing.length > 0) {
          const added = missing.map((name) => `${name}=dev-mock`).join('; ');
          request.setHeader('cookie', `${added}${cookie ? `; ${cookie}` : ''}`);
        }
      });
    },
  },
};

/**
 * Two documents, two entries (ADR 0030): index.html is the back office and pos.html is the till. The dev
 * and preview servers serve pos.html for `/pos` and `/pos/...`, by the same rule the routers use
 * (`entryFor`); everything else falls back to index.html as before. A production host needs the same
 * rewrite.
 */
const routeToEntryDocument: Connect.NextHandleFunction = (request, _response, next) => {
  const url = new URL(request.url ?? '/', 'http://console.local');
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
  investor: fileURLToPath(new URL(`./${ENTRY_DOCUMENT.investor}`, import.meta.url)),
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
    // end-to-end build's fake server answers them; a build for a real API leaves it unset. Unit tests
    // (mode `test`) read it live, so a test can switch a request on.
    define: {
      'process.env.HK_API_BASE_URL': JSON.stringify(env['HK_API_BASE_URL'] ?? ''),
      ...(mode === 'test'
        ? {}
        : {
            'process.env.HK_REQUESTED_CONTRACT': JSON.stringify(env['HK_REQUESTED_CONTRACT'] ?? ''),
            'process.env.HK_SHOP_URL': JSON.stringify(env['HK_SHOP_URL'] ?? ''),
          }),
    },
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
    server: { proxy: mockProxy },
    preview: { proxy: mockProxy },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['src/**/*.integration.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
