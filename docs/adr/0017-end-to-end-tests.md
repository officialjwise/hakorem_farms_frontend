# 0017. End to end tests: Playwright with axe, against production builds, at 360 px

- Status: accepted
- Date: 2026-11-14
- Session: F1

## Decision

- A workspace package `e2e/` (`@hakorem/e2e`) holds Playwright 1.64.1 (the same release Storybook's browser tests use, so one Chromium serves both) and `@axe-core/playwright` 4.14.0.
- Every spec runs in Chromium at **360 x 740**. The `console` project runs against `vite preview` of the production build, so the minified bundle and the service worker are what is tested. The `storefront` project runs against `next start`, on **port 3100**, because 3000 is a common dev port and was held by a Docker container on the owner's machine. Playwright starts both servers; `pnpm test:e2e` builds both apps first.
- `expectNoAxeViolations` runs axe with the WCAG 2.0, 2.1 and 2.2 A and AA tags and is never given a rule to skip. Each route is checked in light and dark.
- Sessions are driven with Playwright's clock (`page.clock`), so a ten minute access token and a silent refresh take milliseconds.
- CI builds both apps and runs the e2e project after the story tests.

## Consequences

- The Playwright specs are the primary-flow record the `hakorem-screen` skill asks for. From F2 the same projects gain a mock server and, nightly, staging (`test:e2e:staging`).
