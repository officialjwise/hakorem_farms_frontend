# 0060. The shop keeps a card request's key in the tab's session storage, for one checkout

- Status: accepted (owner, 2026-11-25: "store the order's request key in session storage for that one checkout only, cleared when the checkout finishes or expires. The key alone must open nothing; the server checks it belongs to this browser's checkout.")
- Date: 2026-11-25
- Session: F10q
- Extends: ADR 0041 (the storefront's data layer)

## Context

Paying by card (contract 2.30.0): `placeOrder` places the order and answers Paystack's page. When the page cannot be opened, it answers 503 `PAYMENT_PROVIDER_UNAVAILABLE` with the order placed. A replay with the same `Idempotency-Key` opens that order's page and never places a second order. F10p kept the key in memory, so a reload during the 503 lost it. The shop could then not open the page for the order it had placed, and paying again would need a new key on a checkout that is no longer open.

## Options considered

1. **Keep the key in memory.** As F10p did. A reload loses the order's page.
2. **Local storage.** It outlives the tab and is shared by every tab. A payment key would stay on the device after the customer is done.
3. **The tab's session storage, for one checkout,** cleared once the checkout is done with. It survives a reload, ends with the tab, and is never shared with another tab.

## Decision

Option 3, in `apps/storefront/src/lib/cardRequest.ts`.

- **What is kept:** one entry, `hk_card_request`: the checkout's id, the exact body sent as JSON, the key, and whether the server answered that the card page did not open. It is only ever a card request: an entry of any other shape is not read.
- **When:** written just before a card `placeOrder` is sent, so a reload while it is on its way still replays the same request. It is marked when the 503 arrives.
- **Cleared:**
  - when the card page is handed over (any 2xx);
  - when the request is refused with nothing placed (a 4xx before the 503);
  - when the checkout reads expired, cancelled or completed;
  - once the checkout's `reservedUntil`, as the server reads it now, has passed;
  - when another checkout is open in the tab.
    Session storage ends with the tab in any case.
- **After a reload:** the review reads the entry for its checkout (`useSyncExternalStore`, nothing on the server render). If the 503 had arrived, the page says again that the order is placed but its card page did not open, the details stay locked, and its one button replays the same body with the same key.
- **The key alone opens nothing.** It goes only in `placeOrder`'s `Idempotency-Key`, on that checkout, with the guest cookie that proves the checkout is this browser's. It never goes in an address, a log or local storage. CR-066 asks the backend to state that a replay is checked the same way.

## Consequences

- A reload during a 503 can still open the order's card page. Proved by `e2e/specs/storefront/checkout-card.spec.ts`, which reloads and replays, and by `cardRequest.test.ts`.
- A refused storage (a private window) keeps nothing, and the shop works as it did in F10p.
- Another tab with the same cart has no key. It sees the checkout as the server reads it, and cannot replay. A replay belongs to the tab that asked.
- Revisit this when CR-065 lands. The 503 would then name its order, and the customer's return from the card page would carry its own token.
