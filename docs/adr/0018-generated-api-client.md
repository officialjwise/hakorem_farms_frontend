# 0018. The API client is generated from the contract, behind openapi-fetch

- Status: accepted (owner's brief for F2, 2026-11-14; the choice of wrapper is recorded as assumption A-F2-01)
- Date: 2026-11-14
- Session: F2

## Context

`contract/openapi.yaml` is the only truth about the API (600 operations, 1.1.0). F2 needs a client no screen can get wrong: no hand-written type, no guessed field, no direct `fetch`. The brief names `openapi-typescript` for the types and asks for a typed fetch wrapper, either `openapi-fetch` or a small wrapper of our own, whichever is more conservative.

## Options considered

1. **A wrapper of our own over the generated `paths`.** No extra dependency, but we would write and own path templating, query serialisation (arrays, `explode`), body handling and abort plumbing, and each is a place for a quiet bug.
2. **`openapi-fetch` (same maintainers as `openapi-typescript`, about 6 KB).** It does the serialisation and is widely used. Its types are keyed by path and method, not by operation id, and instantiating them over 600 operations is heavy.
3. **`openapi-fetch` used through one thin file** that keys everything by operation id.

## Decision

Option 3.

- `packages/api-client` (`@hakorem/api-client`) holds `src/generated/schema.ts` (openapi-typescript 7.13.0) and `src/generated/operations.ts`, a table of every operation id with its method, path, `x-permission`, whether the contract requires `Idempotency-Key`, the `X-CSRF-Token` rule, and whether the operation is public (`security: []`). Both are written by `scripts/generate.ts` and committed. `generated/` is already ignored by Prettier and ESLint.
- `src/client.ts` is the only file that calls `fetch` for the API (`createApiClient().call(operationId, input, options)`). It uses `openapi-fetch` 0.17.0 for serialisation, typed loosely on purpose (one `as unknown as` at the boundary, with a comment), and puts the contract's types on the public signature instead: `OperationInput`, `OperationData`, an idempotency key required exactly when the contract requires one. `client.typetest.ts` proves the signature rejects an unknown operation, a missing path parameter, a missing key, a wrong body and a key on a read.
- The headers the contract requires (`Idempotency-Key`, `X-CSRF-Token`) are not part of a caller's input: the client adds them.
- `scripts/sync-contract.sh` copies `../backend/contract/openapi.yaml` into `contract/`, regenerates, then runs `pnpm typecheck` and exits non-zero with a message if any app no longer compiles. `--check` copies nothing, regenerates in memory and fails if the committed files differ, then type checks; CI runs it, so a stale client cannot merge.
- `yaml` 2.9.1 is a dev dependency of the package, only so the generator can read `x-permission` and the header parameters. Non-JSON request bodies (the file upload) are not typed yet: no screen needs one before F4.

## Consequences

- A contract change surfaces as a type error in the screens, not a runtime surprise.
- `schema.ts` is about 90,000 lines. It type checks in about a second, and it is a build input, not something anyone reads.
- A breaking contract change is fixed by following the type errors; nobody pins to an old contract.
- Revisit if `openapi-fetch` stops being maintained: `call()` is the only consumer, so replacing it is a one-file change.
