# 0038. Say every refusal in the console's words, once, where the API client throws

- Status: accepted
- Date: 2026-11-15
- Session: F6b

## Context

The contract lists every code an operation can refuse with (`x-error-codes`, 83 codes in 1.28.0). A business-rule refusal also names each broken rule in `details[].code`: `FARM_BRANCH`, `OUTPUT_SOLD`, `TAG_NOT_EDITABLE` and so on. Until now a screen showed the server's `message`, which is safe but written for any client. It never showed the rule codes (A-F6-07). The auth screens already map their codes to words and fall back to the server's sentence (`auth/screens/failure.tsx`). The owner asked for the same everywhere: map the documented codes to words in the i18n files, and fall back to the server's message for any code the build does not know.

## Options considered

1. **Translate once, where the console's API client throws** (`data/api.ts`). Every `MutationFailure`, `FormError`, `ConfirmDialog` and `QueryBoundary` shows the same words, and no screen changes. The cost is a small module that holds the catalogue lookup.
2. **A `describe` prop on the failure components in `packages/ui`.** Each screen passes its translator. That means dozens of call sites, and one forgotten prop shows the server's sentence.
3. **Translate in `packages/data`.** That couples the data layer to i18next, which ADR 0008 keeps in the apps.

## Decision

- **The words live in `common:refusals`.** `codes.<CODE>` is the code's sentence, and `rules.<CODE>` is a broken rule's sentence. `common` loads with both documents, so the words are there before any write.
  - **Amended F10i (2026-11-18), the place only:** the words moved to a `refusals` namespace of their own, with the same `codes` and `rules` tables, so the till need not carry them in its first load. The back office loads it at boot; the till fetches it once the sale screen is up, and a refusal that arrives sooner waits for it (`inWordsWhenLoaded`). Nothing else in this decision changes.
- **`data/refusals.ts`, `inWords(error)`,** rebuilds the `ApiError` with:
  - the message set to the code's words, followed by the words of each broken rule in `details[]`, whether or not its detail names a field. A confirmation often has no field to hold a rule: closing a branch names `/status`, which no form on that screen has. A rule without words adds the server's sentence only when its detail names no field;
  - the code, status, reference, `retryAfter` and details unchanged, so a screen still branches on the code (`STEP_UP_REQUIRED`, a 409).
- **What is left alone:** a detail without words that names a field keeps the server's sentence, which `mapServerErrors` puts on that field. A code with no words keeps the server's message, which the contract marks safe to show. A network failure is left as it is, and the screen says it in its own words.
- **The client applies it.** `data/api.ts` wraps `call()`, and `DataProvider` attaches the catalogue lookup, as it attaches the session (`attachRefusalWords`).
- **A unit test reads `contract/openapi.yaml`** and fails if any code in any `x-error-codes` has no words. A synced contract that adds a code fails it until the code is worded. A user never sees a blank: the fallback still holds.
- **The auth screens keep their own mapping** (`failure.tsx`). Their client does not go through the data layer (ADR 0024).

## Consequences

- **A refused branch close now says why in words** (A-F6-07 resolved): "This branch cannot be closed. It is the farm, where the animals are kept. It still holds stock: move or sell it first."
- **Hold kinds keep the server's sentence.** On `STOCK_UNIT_ON_HOLD` the detail's message carries the hold's end date. The kinds are not given rule words, so that date is kept.
- **Writing a new code's words is part of every contract sync.** The coverage test enforces it.
- **Revisit** if the console gains a second language, which this already supports, or if the contract starts to describe each code's meaning in the YAML, so the words could be checked against it.
