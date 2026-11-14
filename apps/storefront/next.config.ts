import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // The workspace packages ship TypeScript source (ADR 0002), so Next compiles them.
  transpilePackages: ['@hakorem/ui', '@hakorem/i18n'],
  // The workspace root, so Next traces files from the packages and not from a stray lockfile in a parent folder.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  reactStrictMode: true,
  // ESLint runs once, from the repository root (`pnpm lint`), with the token and a11y rules. Next's own pass would be a second, weaker copy.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
