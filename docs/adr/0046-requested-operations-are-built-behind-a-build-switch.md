# 0046. Build against a contract request behind a build switch, never by calling what the contract lacks

- Status: accepted (owner, 2026-11-17), on three conditions, each enforced (below). Proposed in F10: the owner asked for "a local mock override shaped exactly as" CR-032 and CR-033 (F9 report); this is how
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
- **The e2e build** (`pnpm test:e2e`, `pnpm screenshots`, CI) is built with `HK_REQUESTED_CONTRACT=CR-032,CR-033` (CR-034 until it landed in 2.0.0), and `e2e/support/requested.ts` answers the requested operations after the same session and permission checks as the rest of the fake.
- **When a request lands**: sync, delete its module and its id from `CONTRACT_REQUESTS` in `switch.ts`, call the generated client, and drop the id from the builds. Its screens and specs stay.

## The owner's conditions (2026-11-17)

Approved "if every switch names its contract request, is deleted when that request lands, and a production build fails if a switch is on for an operation the contract doesn't carry". Each is enforced, not only written down:

1. **Every switch names its request.** A switch is a request id (`CR-032`), and `CONTRACT_REQUESTS` in `requested/switch.ts` lists only ids; an id with no module fails the build's first read. Every `RequestedOperation` carries its `request`.
2. **Deleted when the request lands.** `requested/landed.ts` checks, at type-check time, that the generated client still lacks what each request asks for (an operation or a response field; for CR-034, until it landed in 2.0.0 and its switch was deleted, that `ProductCreate` still required `sku`). When `pnpm sync-contract` brings a contract that carries it, the type check fails with "CR-0xx is in the contract now: delete its switch", so the sync cannot be committed with the switch in place. `switch.test.ts` fails if a switch has no such check. `callRequested` still refuses an operation the manifest lists, at run time.
3. **A build for a real API fails with a switch on.** `vite.config.ts` calls `assertSwitchesAllowed` before anything is built: with any switch on, a build or dev server whose `HK_API_BASE_URL` is anything but `/mock` stops with an error naming the switches. Every switch is for a shape the contract does not carry (condition 2), so this is the rule "a switch on for an operation the contract doesn't carry" in a production build. Only the e2e and CI builds, against `/mock`, set it.

## Consequences

- The till's PIN and receipt flows are built and proved end to end against the requested shapes, and a production build calls nothing the contract does not list.
- The proof is only as good as the request: the fake answers what the frontend asked for. If the backend lands a different shape, the screens follow the contract, as for any change.
- A deploy cannot set `HK_REQUESTED_CONTRACT`: its build is for a real API, so it fails before building (condition 3). DEPLOYMENT.md says so.
- Revisit if a request needs a server state the e2e fake cannot hold.
