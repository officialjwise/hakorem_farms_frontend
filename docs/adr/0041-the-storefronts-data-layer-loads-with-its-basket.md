# 0041. Load the storefront's data layer with the basket, not with every page

- Status: accepted
- Date: 2026-11-16
- Session: F7

## Context

ADR 0022 mounts one `QueryClientProvider` per app at its root. In the storefront that put TanStack Query, the generated client and its 635-row operation table into every page's first load, about 30 kB gzipped, although a public page reads its data on the server and only the basket and the checkout use the data layer in the browser. A listing page measured 231 KB of script on the wire on a first visit, against a 120 KB provisional sub-budget (A-F0-06) and a 300 KB page budget the brief sets.

## Options considered

1. **Keep the root provider.** Every page pays for the basket.
2. **One QueryClient, mounted by each island that uses it.** The basket count, the drawer, "Add to basket" and the checkout each wrap themselves in `ShopData`, which mounts the same browser-wide client, so they still share one cache. The islands load on demand; the count loads only when this device has a cart.
3. **No data layer in the storefront**: hand-written calls for the basket. Refused: no screen calls the API outside `useApiQuery` and `useApiMutation`.

## Decision

Option 2.

- `shopQueryClient()` (`apps/storefront/src/lib/browserApi.ts`) is the one client in the browser. On the server, where the islands also render once, every call returns a new client, so no request shares another's cache.
- `ShopData` mounts it. Only `CartCount`, `CartSheet`, `AddToBasket` and `CheckoutFlow` import it.
- The header's basket button has no data layer of its own. It reads the remembered cart id, loads `CartCount` only when there is one, and loads the drawer on the first tap.
- `Providers` mounts the `UIProvider` alone.
- Product links in a listing do not prefetch: twelve routes fetched ahead on 3G cost more than one tap waits.

## Consequences

- A first visit that only browses loads no data layer. The listing's script on the wire fell from 231 KB to 202 KB (F7, `docs/PERFORMANCE_BUDGET.md`).
- A new island that uses the basket must wrap itself in `ShopData`; without it, it fails at once with TanStack's "No QueryClient set", which the integration tests would catch.
- The console is unchanged: it keeps ADR 0022's single root provider, because every back-office screen uses the data layer.
