import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';

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
const mockProxy: Record<string, ProxyOptions> = {
  [`^${MOCK_PATH}(/|$)`]: {
    target: PRISM,
    changeOrigin: true,
    rewrite: (path) => path.slice(MOCK_PATH.length) || '/',
    configure: (proxy) => {
      proxy.on('proxyReq', (request) => {
        const cookie = String(request.getHeader('cookie') ?? '');
        if (!cookie.includes(`${STAFF_COOKIE}=`)) {
          request.setHeader('cookie', `${STAFF_COOKIE}=dev-mock${cookie ? `; ${cookie}` : ''}`);
        }
      });
    },
  },
};

export default defineConfig(({ mode }) => {
  // HK_API_BASE_URL is the one variable that decides mock or real API (ADR 0019). The literal
  // `process.env.HK_API_BASE_URL` in @hakorem/api-client is replaced here, at build time.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: { 'process.env.HK_API_BASE_URL': JSON.stringify(env['HK_API_BASE_URL'] ?? '') },
    build: { sourcemap: true },
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
