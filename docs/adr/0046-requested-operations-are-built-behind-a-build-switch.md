# 0046. Build against a contract request behind a build switch, never by calling what the contract lacks

- Status: proposed (the owner asked for "a local mock override shaped exactly as" CR-032 and CR-033, F9 report; this is how)
- Date: 2026-11-16
- Session: F10

## Context

The F9 report's opening message asks for the till PIN and the digital receipt "against a local mock override shaped exactly as CR-032 [and CR-033] asks until it lands". Neither is in the contract (1.44.0). CLAUDE.md forbids calling an endpoint the contract does not list and hand-writing an API type, and the shared brief forbids mock data in committed code. Until now every screen built against the mock used operations the contract already carried (Prism answered them); nothing in the console calls an operation the contract does not list.

The override needs three things: types for the requested shapes, a way to send the requested operation through the same transport as every other call (session refresh, CSRF, the till's credential, timeouts, the one error envelope), and a guarantee that a build for the real API never calls it.

## Options considered

1. **Hand-add the operations to the generated client.** Breaks `sync-contract:check` and lies about the contract.
2. **A bare `fetch` in the till for the missing operations.** A second transport, without the refresh, CSRF or the device credential, and a screen calling `fetch`.
3. **The requested operations described in the console, sent through the client's own transport, and switched on only in a build that names them.** The end-to-end build names them and its fake server answers them in the requested shape; a build for a real API names none.

## Decision

Option 3.

- **`HK_REQUESTED_CONTRACT`**, a comma-separated list of request ids (`CR-032,CR-033`), read at build time as `HK_API_BASE_URL` is (`apps/console/vite.config.ts`). Unset means none. An id the console has no module for fails the build's first read with a message naming it. Unit tests read it live.
- **`apps/console/src/requested/`** holds one module per request, with the request's shapes as types and the operation described as a manifest row (`RequestedOperation`: method, path, permission, CSRF, the device credential). Each type and row cites its request. Nothing outside `requested/` declares a requested shape.
- **`ApiClient.callRequested(operation, input, options)`** sends it through the same transport as `call`, and refuses an operation the generated manifest now lists, so the request is deleted rather than kept beside the real operation.
- **Fields a request adds to an existing response** (`OfflinePack.receiptLinkTemplate`, `SyncResultItem.receiptMessage`) are read only by the request's module, and only with the switch on. The stored record keeps whatever the server sent, so nothing is lost when the field lands.
- **With the switch off**, every screen that depends on a request says in words what is not available and carries on: no PIN lock, no offline mobile money, no witness, no receipt link. The sale is never blocked.
- **The e2e build** (`pnpm test:e2e`, `pnpm screenshots`, CI) is built with `HK_REQUESTED_CONTRACT=CR-032,CR-033,CR-034`, and `e2e/support/requested.ts` answers the requested operations after the same session and permission checks as the rest of the fake.
- **When a request lands**: sync, delete its module and its id from `CONTRACT_REQUESTS` in `switch.ts`, call the generated client, and drop the id from the builds. Its screens and specs stay.

## Consequences

- The till's PIN and receipt flows are built and proved end to end against the requested shapes, and a production build calls nothing the contract does not list.
- The proof is only as good as the request: the fake answers what the frontend asked for. If the backend lands a different shape, the screens follow the contract, as for any change.
- A deploy that sets `HK_REQUESTED_CONTRACT` against a backend without the operations gets a refusal (404) where the request is used; the till shows the feature as unavailable. DEPLOYMENT.md says not to set it.
- Revisit if a request needs a server state the e2e fake cannot hold.
