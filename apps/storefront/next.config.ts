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
  poweredByHeader: false,
  reactStrictMode: true,
  // ESLint runs once, from the repository root (`pnpm lint`), with the token and a11y rules. Next's own pass would be a second, weaker copy.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
