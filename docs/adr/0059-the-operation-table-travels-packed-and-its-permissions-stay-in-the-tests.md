# 0059. The operation table travels packed, and its permissions stay with the tests

- Status: accepted (the owner's rule, 2026-11-25: free at least 10 kB of the till's first load before the next sale-screen feature, without harm)
- Date: 2026-11-25
- Session: F10q
- Amends: ADR 0018 (the generated client)

## Context

The till's first load was 247.0 of 250 kB. Its largest piece of the project's own code was the generated operation table, `operationManifest`: 669 rows, each an object of eight named fields, about 11.9 kB gzipped in every document. `call()` reads five of those fields to send a request. It never reads `permission`: a screen decides by the session's permissions and its route's own declaration. Only the tests and the e2e fake read `permission`, to check routes and roles against the contract.

## Options considered

1. **Load the table on demand.** `call()` is asynchronous, so it could import the table on first use. But every document calls the API within a second of starting, so the same bytes arrive straight after the first render. That moves the number without cutting the payload.
2. **A table per document,** holding only the operations that document calls. That would be the smallest, but it needs a build step that finds every operation id in the source. A missed id fails at run time, in front of a cashier.
3. **The same table in a smaller form.** The rows stay exactly as typed. The interface carrying their literal types costs nothing at run time. The rows travel as one string, one operation per line, and the module turns them back into the same objects when it loads. `permission` moves to a table of its own that only the tests and the fake import.

## Decision

Option 3.

- `generated/operations.ts` exports `interface OperationManifest`, with every field of every row as a literal type, and `operationManifest`, built from `PACKED` by `unpackOperations` (`src/manifest.ts`). A line reads `<id> <method> <path> <idempotent><public><device> <csrf> <body>`, for example `syncOfflineSales p /pos/sync 001 r j`.
- The generator packs with `packOperations` from the same module, so packing and unpacking cannot drift. `manifest.test.ts` checks the round trip for every method, flag, CSRF rule and body, and checks one real row against the contract.
- `generated/permissions.ts` exports `operationPermissions`, each operation's `x-permission`. `fakeRoles.test.ts`, `routes.test.ts` and `e2e/support/fakeApi.ts` read it. No app imports it, and the bundler leaves it out.
- `OperationRow` no longer has `permission`. `RequestedOperation` keeps its own (ADR 0046).

## Consequences

- **Measured** (`pnpm budget:console`, 2026-11-25, with CI's build switches): the till 247.0 to 242.7 kB, the back office 288.8 to 284.5 kB and the investor portal 213.6 to 209.2 kB, from this change alone. The shop's pages call no operation through this table at first load and are unchanged.
- Unpacking 669 lines when the module loads takes under a millisecond.
- A contract change still reads as a one-line diff in `operations.ts`, in the packed block and in the interface.
- A path holding white space, a backtick, a dollar sign or a backslash fails the generator, so the string cannot be broken. No contract path holds any of them.
- Revisit this if a screen ever needs to read an operation's permission at run time. It would then import `operationPermissions` on purpose, and the budget would show the cost.
