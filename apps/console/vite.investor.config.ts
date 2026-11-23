import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import type { Connect, Plugin } from 'vite';
import { INVESTOR_DOCUMENT } from './src/investor/entry.ts';
import { assertSwitchesAllowed } from './src/requested/switch.ts';
import { buildDefines, INVESTOR_COOKIE, MOCK_PATH, mockProxy } from './vite.shared.ts';

/**
 * The investor portal's own build (ADR 0058, the owner on 2026-11-23): `pnpm build:investor` writes
 * `dist-investor/`, served on the portal's own host and never under the console's address. It shares the
 * console's source (the design system, the data layer, the sign-in screens and `boot()`), not its build:
 * how the bundler splits the portal's code changes nothing in the till's or the back office's.
 *
 * Its one document answers every address on its host that is not a file. Its dev and preview servers do
 * the same, on ports of their own (5174 and 4174), and their `/mock` proxy adds the investor cookie only.
 */
const document = fileURLToPath(new URL(`./${INVESTOR_DOCUMENT}`, import.meta.url));

const routeToPortal: Connect.NextHandleFunction = (request, _response, next) => {
  const url = new URL(request.url ?? '/', 'http://investor.local');
  // A file (an asset, a module in dev, Vite's own client) is served as itself, and `/mock` goes on to
  // Prism; every other address is a page of the portal.
  const passes =
    /\.[^/]+$/.test(url.pathname) ||
    url.pathname.startsWith('/@') ||
    url.pathname === MOCK_PATH ||
    url.pathname.startsWith(`${MOCK_PATH}/`);
  if (!passes) {
    request.url = `/${INVESTOR_DOCUMENT}${url.search}`;
  }
  next();
};

/** The portal takes the two icons its document links to, not the console's manifest or service worker. */
const ICONS = ['icons/icon.svg', 'icons/icon-192.png'];
const portalFiles: Plugin = {
  name: 'hakorem-investor-portal',
  configureServer: (server) => void server.middlewares.use(routeToPortal),
  configurePreviewServer: (server) => void server.middlewares.use(routeToPortal),
  generateBundle() {
    for (const fileName of ICONS) {
      const source = readFileSync(fileURLToPath(new URL(`./public/${fileName}`, import.meta.url)));
      this.emitFile({ type: 'asset', fileName, source });
    }
  },
};

const proxy = mockProxy(INVESTOR_COOKIE);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The same rule as the console's (ADR 0046): a switch only in a build against the mock. The portal
  // calls no requested operation, so its builds leave HK_REQUESTED_CONTRACT unset.
  assertSwitchesAllowed(env['HK_REQUESTED_CONTRACT'], env['HK_API_BASE_URL']);
  return {
    plugins: [react(), tailwindcss(), portalFiles],
    define: buildDefines(env, mode),
    // The console's public files are its own: the portal emits only its icons (above).
    publicDir: false,
    build: {
      outDir: 'dist-investor',
      emptyOutDir: true,
      sourcemap: true,
      // dist-investor/.vite/manifest.json, read by `pnpm budget:console` for the portal's first load.
      manifest: true,
      rolldownOptions: {
        input: { investor: document },
        output: {
          chunkFileNames: (chunk) =>
            chunk.isDynamicEntry ? 'assets/[name]-[hash].js' : 'assets/shared-[hash].js',
          assetFileNames: (asset) =>
            asset.names.some((name) => name.endsWith('.css'))
              ? 'assets/styles-[hash][extname]'
              : 'assets/[name]-[hash][extname]',
        },
      },
      chunkSizeWarningLimit: Number.POSITIVE_INFINITY,
    },
    server: { port: 5174, proxy },
    preview: { port: 4174, proxy },
  };
});
