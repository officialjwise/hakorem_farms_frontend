# 0019. Prism is the mock, and one environment variable chooses the API

- Status: accepted (owner's brief for F2, 2026-11-14)
- Date: 2026-11-14
- Session: F2

## Context

The frontend builds against a mock until the backend module exists. The brief fixes Prism on port 4010 started by `pnpm dev:mock`, and says a single environment variable decides mock or real, in one module, and nothing else.

## Options considered

1. `npx @stoplight/prism-cli` on demand. Unpinned, and fetched at run time.
2. **A pinned devDependency run through pnpm.** Reproducible, and `pnpm install` applies `minimumReleaseAge`.
3. A mock service worker or a hand-written fake. Rejected: a mock that is not generated from the contract only proves it agrees with itself.

## Decision

Option 2.

- `@stoplight/prism-cli` 5.16.0 (published 2026-07-17) is a root devDependency. `pnpm dev:mock` runs `prism mock contract/openapi.yaml --host 127.0.0.1 --port 4010`.
- **Its install brings `@scarf/scarf`, whose install script only reports usage telemetry. `pnpm-workspace.yaml` denies it explicitly (`'@scarf/scarf': false`)**; nothing in the tree is allowed to run a script beyond `esbuild`.
- The variable is `HK_API_BASE_URL`, read in exactly one place, `packages/api-client/src/baseUrl.ts`. Its value is the base URL: `http://127.0.0.1:4010` is the mock, the real API's `/v1` URL is the real one. There is no "mock mode" flag, no `NODE_ENV` check and no default: an unset variable throws a message naming it the first time an app needs the API. Vite (`define`) and Next (`env`) replace the literal `process.env.HK_API_BASE_URL` at build time.
- Prism checks the contract's security schemes, and the staff scheme is a cookie the mock cannot set. A request to the mock therefore carries a `Cookie: __Host-hk_s_at=...` header (the integration tests send one). Presence is all Prism checks.
- To get an error state from the mock, send `Prefer: code=403` (or 401, 500): Prism answers with the contract's own example for that status. Prism cannot return an empty list for an endpoint whose only example has rows; see DATA_CONVENTIONS.md.

## Consequences

- The mock and the client come from the same file, so they cannot drift apart.
- A browser cannot send credentials to a `*` CORS origin, so using the mock from the dev server needs a same-origin path (a Vite proxy to port 4010). That is first needed by F3 and is recorded in assumption A-F2-03.
- Integration tests start the pinned Prism themselves (`pnpm test:integration`, docs/DATA_CONVENTIONS.md) and fail, rather than skip, if it will not start. Setting the staff cookie for Node's fetch is test infrastructure (A-F2-09).
