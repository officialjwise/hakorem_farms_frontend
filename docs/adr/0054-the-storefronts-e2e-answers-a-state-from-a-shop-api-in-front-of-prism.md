# 0054. The storefront's e2e answers a state the contract's examples cannot show from a shop API in front of Prism

- Status: accepted (carried from F10e: "decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR")
- Date: 2026-11-17
- Session: F10h

## Context

The storefront reads on its server (ADR 0015): a page asks the API before any HTML reaches the browser. In the e2e suite that API is Prism, which answers every operation from the contract's one example. The console's suite answers other states in the browser (ADR 0026, `fakeApi.rewrite`), but Playwright cannot route a request a Next.js server makes. Until F10h every storefront state a spec needed was either Prism's example or a status Prism can be asked for. The quote by its link (FR-QUO-003) is not: the page must say "expired", "replaced by a newer version", "accepted" and "declined", and `viewQuoteByLink`'s example is only `ISSUED`. The F10 gate is that page on a phone.

## Options considered

1. **Read the quote in the browser.** The page renders a shell, an island reads `viewQuoteByLink` through the data layer, and Playwright routes it. Every state is testable the console's way, but the customer on 3G waits for the data layer's script before seeing the quote, and the test would no longer test the page as it ships.
2. **Many examples in the contract** (`examples` with `Prefer: example=`). The backend's file; it would need a contract request per state, and the server render still sends no `Prefer` header a test can set.
3. **A shop API in front of Prism.** A small Node server in `e2e/support` that answers the reads a state needs from typed fixtures, chosen by a value in the request's path, and passes everything else to Prism unchanged. The storefront's e2e build talks to it.

## Decision

Option 3.

- **`e2e/support/shopApi.ts`** listens on `127.0.0.1:4011`, started by Playwright as a web server (`node support/shopApi.ts`; Node 22 strips the types). Its fixtures are typed from `components['schemas']` and hold the server's figures; nothing in it adds one up.
- **A fixture is chosen by a value in the path**, never by a control route or shared state: `GET /shop/quotes/{token}` answers the quote for that token (one token per state), and any other token the contract's 404 envelope. Specs running in parallel cannot see each other's answers.
- **Everything else is passed to Prism on 4010 unchanged**, preflights included, so the catalogue, the basket and the checkout behave exactly as before.
- **The storefront's e2e build** sets `HK_API_BASE_URL=http://127.0.0.1:4011` (`package.json`'s `test:e2e`, `screenshots` and `test:e2e:quarantine`, and CI's storefront build). The storefront's integration tests still talk to Prism directly.
- **Writes are the browser's**: a spec routes them with `page.route` and checks the body sent, as the console's specs do.
- A new state is a new fixture keyed by a new path value, added only when a page must show it.

## Consequences

- The quote page is tested as it ships: read on the server, readable before any script, on throttled 3G.
- The fake is a second answerer beside Prism. It must stay a list of fixtures in the contract's shapes; if it grows logic (state that changes after a write), revisit, because then it is testing itself.
- A read keyed by something other than its path (a query string, a cookie) cannot be answered this way; that would need a new decision.
