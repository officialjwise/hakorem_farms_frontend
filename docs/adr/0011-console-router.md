# 0011. The console uses React Router 7 in library mode, pinned to 7.18.5

- Status: accepted (decided by the F1 session under the standing "most conservative option" rule; owner confirms, see A-F1-01)
- Date: 2026-11-14
- Session: F1

## Context

The console is a Vite single page app with two shells behind one build (back office and POS). It needs nested layouts, a per-route declaration (permission, shell, breadcrumb), code splitting, a place to hang a dirty-state guard (F0's `useDirtyGuard` needs a router adapter) and a router that tests can drive in memory.

## Options considered

1. **React Router 8.5.1 (the newest release at least two weeks old).** It requires Node 22.22 or newer. `package.json` pins `>=22.12 <23` and CI and the owner's machine run 22.17, so it does not install cleanly. Ruled out by Node, not by taste.
2. **React Router 7.18.5, library mode with `createBrowserRouter`.** The data router API: nested routes, `handle` per route, `useMatches` for breadcrumbs and guards, `useBlocker` for the dirty guard, `createMemoryRouter` for tests. Peer range is React 18 or newer, Node 20 or newer.
3. **TanStack Router.** Excellent type safety, but it brings its own file or code-route conventions and a second mental model. Nothing here needs it yet.
4. **Next.js for the console too.** The brief fixes React 19 and Vite for the console, and the POS must work offline from a static build.

## Decision

- React Router **7.18.5**, imported from `react-router` only (the merged package, not `react-router-dom`), library mode, `createBrowserRouter`, no framework mode, no file based routing.
- Every route is an object in `src/app/routes.tsx`. A route behind sign-in declares `handle: { permission, shell, crumb }` (ADR 0016).
- The POS shell is loaded with `React.lazy`, so the back office never downloads it.
- `useDirtyGuard`'s router adapter (`useBlocker`) is not wired in F1, because no screen has a form that leaves unsaved work yet. The first form screen in F3 wires it.

## Consequences

- Moving to React Router 8 is a version bump once the Node floor moves to 22.22. Revisit then.
- Route objects are plain data, so a test can walk the tree (`routing/routes.test.ts`).
