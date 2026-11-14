# 0016. A console route declares its permission in `handle`, and a route that declares nothing is denied

- Status: accepted
- Date: 2026-11-14
- Session: F1

## Context

BUILD_PROMPT F1: every route declares the permission it needs, and renders the permission-denied state when the user lacks it, never a silent redirect.

## Decision

- Each route behind sign-in has `handle: { permission, shell, crumb }` (`src/routing/handle.ts`). `permission` is a code from the contract's `x-permission` values, or `null` for any signed-in user (the dashboard). It is never omitted.
- `SessionGate` (a layout route) owns the session states: loading, error with retry, expired (words, a sign-in link that remembers the page), and anonymous (the one place a redirect is right, to sign-in with `?next=`). A `next` that is not an in-app path is ignored.
- `PermissionGate` reads the deepest match's `handle`. No handle means denied (deny by default). A missing permission renders `ErrorState` with a lock, the words, and the permission code, on the same URL, inside the shell so the user can get out. The POS gate wraps the whole shell, so a denied user never gets a barcode field.
- The sidebar offers only destinations the user may open. The address still answers honestly.
- `routing/routes.test.ts` walks the route table and fails if a leaf has no handle. The server still enforces every permission; this is a hint, as the contract says.

## Consequences

- Adding a screen means adding a route with its handle, and the test tells you if you forget.
- Granular checks inside a screen (hide a button) use `useAuth().can(code)`.
