import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // The workspace packages ship TypeScript source (ADR 0002), so Next compiles them.
  transpilePackages: ['@hakorem/ui', '@hakorem/i18n', '@hakorem/api-client', '@hakorem/data'],
  // HK_API_BASE_URL is the one variable that decides mock or real API (ADR 0019). Next replaces the literal
  // `process.env.HK_API_BASE_URL` in @hakorem/api-client with this value, on the server and in the browser.
  env: { HK_API_BASE_URL: process.env.HK_API_BASE_URL ?? '' },
  // The workspace root, so Next traces files from the packages and not from a stray lockfile in a parent folder.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // Import each @hakorem/ui component from its own module rather than the package's index, so a page's
  // client bundle carries only the components it renders (ADR 0042). Without it, every client component
  // the index exports reached the listing's script.
  experimental: { optimizePackageImports: ['@hakorem/ui'] },
  poweredByHeader: false,
  // A quote's private link (/q/<token>): the token is the customer's acceptance key, so the page is never
  // indexed and the link is never sent on as a referrer to anything it opens (CR-047).
  async headers() {
    return [
      {
        source: '/q/:token*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
  reactStrictMode: true,
  // ESLint runs once, from the repository root (`pnpm lint`), with the token and a11y rules. Next's own pass would be a second, weaker copy.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
