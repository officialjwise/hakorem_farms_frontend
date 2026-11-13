---
name: hakorem-contract-sync
description: Use at the start of every frontend session and whenever contract/openapi.yaml may have changed, including after a backend session report mentions a contract change. Fires when reading the contract, handling a breaking change, or about to write to docs/CONTRACT_REQUESTS.md. Enforces syncing, reading the changelog, handling breaking changes and writing a contract request instead of inventing an endpoint.
---

# Syncing the contract

The backend owns `contract/openapi.yaml` and never breaks it silently. The frontend consumes a copy and never edits it. Read `docs/SHARED_BRIEF.md` ("The contract") and `docs/BUILD_PROMPT.md` ("How to run this prompt").

## What exists today

- `contract/openapi.yaml` is a **plain byte-for-byte copy** from `../backend/contract/openapi.yaml` (contract 1.1.0 at F0b). Prettier ignores `contract/`.
- **Arrives in F2, not built yet:** `scripts/sync-contract.sh` (copy, regenerate `packages/api-client`, fail loudly if the apps no longer compile), `pnpm sync-contract`, and the CI step that runs it against the committed contract.
- Until F2, sync by copying the file by hand and recording the backend commit in the session report.

You may read `../backend/contract/` and `../backend/docs/CONTRACT_CHANGELOG.md`. Never read `../backend/src/` and never write anything under `../backend/`.

## Every session

1. Sync the contract (script from F2; a plain copy before that).
2. Read `../backend/docs/CONTRACT_CHANGELOG.md` for anything added since the last session.
3. Read the backend's latest session report for which modules went live.
4. For each screen whose module is now live, move it from the mock to the real API.
5. In your report state: which screens moved from the mock, and what you added to `docs/CONTRACT_REQUESTS.md`. The other track relies on those two lines.

## A breaking change

A breaking change carries a version bump and a changelog entry. When one lands: update the affected screens in the same session, let the type errors from the regenerated client lead you (F2 onward), and say so in the report. Never pin to an old contract to avoid the work.

## A request, not an invention

When a screen needs something the contract does not offer, append to `docs/CONTRACT_REQUESTS.md`: an id, the date, the screen that needs it, and the exact shape you want, including units (`Pesewas` integer, `Kilograms` three-place string, cost and price as separately named fields). Then carry on against a local mock override. **Read the contract first.** CR-002 was withdrawn because the shapes already existed.

## Facts to check before raising a request

- `Pesewas`: non-negative int64, never a float. Direction travels in a separate field.
- `Kilograms` and `Quantity`: strings with exactly three places. `SignedQuantity` may be negative.
- A value that does not apply is `anyOf` the schema or `null`, and a null can carry a meaning (a null `thresholdPesewas` means "always"). Read the field's description.
- Errors are the single `Error` envelope. Pages are cursor based.

## Correct

An example, not a real request:

```md
## CR-003. Goods receipt line needs the supplier's batch number

- **Raised by:** frontend F5, goods receipt screen
- **Shape:** `batchNo: string | null` on `GoodsReceiptLine`, null when the supplier gave none.
- **Checked:** `contract/openapi.yaml` 1.1.0 has `StockUnit.identifier` but no field on the receipt line.
- **Until this lands:** F5 builds against a local mock override with exactly this field.
```

## Incorrect

```ts
// The contract has no such endpoint, so the screen invents one and a type for it.
const res = await fetch('/api/v1/receipts/batch-lookup');
type BatchLookup = { batch: string };
```

It calls an endpoint nobody offered, hand-writes the type, and tells the backend nothing.
