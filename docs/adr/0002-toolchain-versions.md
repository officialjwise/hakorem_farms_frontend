# 0002. Toolchain versions and where we deliberately hold back

- Status: accepted
- Date: 2026-11-13
- Session: F0

## Context

The brief fixes TypeScript 5.x, React 19 and Node 22 LTS. Several tools have shipped majors that are newer than the brief or not yet supported by their ecosystem. Supply-chain hygiene also argues against installing anything published in the last two weeks.

## Decision

- **Every dependency is pinned exactly**, the lockfile is committed, and `pnpm-workspace.yaml` sets `minimumReleaseAge` to two weeks. Install scripts run only for packages listed in `allowBuilds` (currently `esbuild`).
- **pnpm 11.28.9**, not 12. pnpm 12 ships as a native binary that the corepack bundled with Node 22.17 cannot launch.
- **TypeScript 5.9.3**, not 7.0. The brief says 5.x, and typescript-eslint supports TypeScript below 6.1.
- **ESLint 10.13.** ESLint 9 has reached end of support. `eslint-plugin-jsx-a11y` 6.10.2 has had no release since 2024 and declares a peer range ending at ESLint 9. Its rules run correctly on ESLint 10, which `pnpm lint` exercises on every run, so the peer range is relaxed in `pnpm-workspace.yaml` rather than dropping the plugin. axe in Storybook remains the primary accessibility gate.
- **Stylelint 17**, **Tailwind CSS 4.3**, **Vite 8**, **Vitest 5**, **Storybook 10.6**, **Playwright 1.64**: each the newest release at least two weeks old.

## Consequences

- If jsx-a11y breaks on a future ESLint release, replace it with a maintained fork or drop it and rely on axe. Record that here.
- `pnpm setup` is a built-in pnpm command, so the brief's setup step runs as `pnpm run setup`.
