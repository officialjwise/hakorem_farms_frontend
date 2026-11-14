# 0015. The storefront: Next.js 15.5.28, theme from a cookie, server translation, client directives in the UI package

- Status: accepted (the Next version is fixed by the brief; the rest is the F1 session's decision, see A-F1-02)
- Date: 2026-11-14
- Session: F1

## Context

The storefront is server rendered, built for 3G, and shares `@hakorem/ui` and `@hakorem/i18n` with the console. Four things needed a decision.

## Decisions

1. **Next.js 15.5.28**, the newest 15.x release at least two weeks old (ADR 0002's policy). The brief fixes 15. App Router, Tailwind 4 through `@tailwindcss/postcss` 4.3.3, `transpilePackages: ['@hakorem/ui', '@hakorem/i18n']` because both ship TypeScript source. No install script needed an `allowBuilds` entry: `sharp` arrives prebuilt through `@img/*` packages. `eslint.ignoreDuringBuilds` is true because ESLint runs once from the repository root with the token and accessibility rules (`pnpm lint`), and `next-env.d.ts` and `.next` are ignored there as generated files.
2. **Theme on `<html>`, server side.** The root layout reads the `hk_theme` cookie (`light`, `dark`, anything else means follow the device) and writes `data-theme` and `data-density="comfortable"` on `<html>` in the first byte, so there is no flash. With no cookie there is no attribute and the generated tokens switch on `prefers-color-scheme`. A crafted cookie value cannot reach the markup (it is checked against an allow list). The cost: reading cookies makes pages dynamic. Revisit for F13 (a CDN needs `Vary: Cookie`, or the toggle moves to a client script that sets the cookie).
3. **Server-side translation.** Server components call `getT(namespace)` (a per request `createI18n`, cached with React `cache`) and pass strings to the few client components as props. No i18n runtime reaches the browser for a page that only reads text. `app/error.tsx` is a client component and keeps its few English words as a constant, so the error page does not depend on the machinery that may have failed.
4. **`'use client'` in `packages/ui`.** Next's server layer refuses a module that imports a hook, so the barrel could not be imported from a server component. A `'use client'` directive is now at the top of every component and form file that uses hooks, context or a Radix primitive (28 files). It is a no-op under Vite and Storybook, adds no mechanism, and leaves pure components (Button, Badge, Card, Skeleton, EmptyState, ErrorState, StatusBadge, the formatters) usable from server components. `hakorem-ui-component` should say so for new components.

## Known limits, recorded, not hidden

- **Soft 404.** A route that streams behind `loading.tsx` has already sent 200 when a page calls `notFound()`. Next marks the page `noindex`, which keeps it out of search. F7 moves the product and category lookups above their Suspense boundary, so the status is exact once data fetching is real.
- **First measurement against A-F0-06.** `next build` reports 103 kB of shared first-load JavaScript and 181 kB on pages that include the cart drawer (gzipped, against the 120 KB script sub-budget). The excess is the one UIProvider (ADR 0006) with its Radix toast, tooltip and dialog code, plus the cart Sheet. Levers for F7 and F13: load the cart drawer on first use, split the toast viewport so a page that never toasts does not pay for it, and trim Radix. Recorded in `docs/PERFORMANCE_BUDGET.md` and for the owner under A-F0-06.
- **No Open Graph image yet.** The tags (title, description, url, site name, type, locale) are present. An image arrives with the catalogue photos in F7.

## Consequences

- Public pages are server components by default. The client leaves are `Providers`, `CartDrawer` and `error.tsx`.
