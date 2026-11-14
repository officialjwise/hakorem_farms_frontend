# 0031. The till loads its sale screen with the document and every other route on demand

- Status: accepted (owner, 2026-11-14: "Add route-level splitting inside the till now, while it has one screen: initial load is the sale screen alone, everything else lazy")
- Date: 2026-11-14
- Session: F3 (after the report, on the owner's second answers)

## Context

ADR 0030 split the till from the back office and left the till 20 kB under its 250 kB budget. F9 adds the sale screen's real content, barcode and weight capture, split tender, hold and recall, returns, shift open and close, and the offline queue. Eager loading cannot fit that into 20 kB, and the owner ruled out a bigger budget. Splitting now, while the till has one screen, sets the pattern before F9 has anything to retrofit.

## Options considered

1. **React Router's `lazy` route property.** This is the router's own mechanism. A gate's `<Navigate>` renders nothing while the chunk downloads, so the screen is blank with no loading state in words.
2. **`React.lazy` behind a `Suspense` boundary, through one helper (`lazyScreen`).** The route renders its loading state at once, in words. Tests can tell a lazy route from an eager one by the `LazyScreen` component.

## Decision

Option 2.

- **What loads with `pos.html`:** the till shell (`PosShell`), the sale screen (`PosHome`, the `/pos` index route) and the hand-off to the back office (`OtherDocument`).
- **What loads on demand:** every other route the till document has, written as `element: lazyScreen(() => import(...))` in `src/pos/routes.tsx` or `src/pos/authRoutes.tsx`. That is the sign-in screens today, and every till route F9 adds.
- **The back office** keeps its sign-in screens eager (`src/app/authRoutes.tsx`), because `/login` is where a signed-out person lands. `appRoutes()` takes each document's sign-in routes as `publicRoutes`.
- **`routes.test.ts`** fails if any till route other than `/pos` and the `*` hand-off is not a `LazyScreen`.
- **`pnpm budget:console`** budgets the initial load only, read from Vite's manifest. It reports the on-demand chunks without budgeting them (PERFORMANCE_BUDGET, "Console").

## Consequences

- **The till's initial load fell from 229.6 to 195.8 kB.** The sign-in screens took the form libraries with them.
- **A cashier who signs out waits for the sign-in chunks** before the sign-in screen appears: at most 42.8 kB, the whole on-demand set. They see "Loading the page" meanwhile.
- **Offline:** a till that is offline before it ever opens a lazy route cannot open it from the network. The service worker must precache every on-demand till chunk (F13, `docs/DEPLOYMENT.md` section 2). Until F13 there is no caching at all (ADR 0013), so this adds no new gap today.
- **F9 must write each new till route with `lazyScreen`.** The test above makes forgetting it a red build.
