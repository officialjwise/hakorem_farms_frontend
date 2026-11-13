# 0007. Money and weight are formatted by our own rules, never by locale

- Status: accepted
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

The storefront renders on the server and the client. `Intl.NumberFormat` depends on the runtime's ICU data, which differs between Node, Chrome and Android WebView versions. A total rendered one way on the server and another way on the client is an invoice that reads two ways, the failure this system exists to prevent.

## Decision

- **No locale formatting for money:** `Intl.NumberFormat` and `toLocaleString` are not used for money.
- **`formatMoney(pesewas)`** lives in `packages/ui`, with explicit rules:
  - comma thousands separator
  - always two decimals
  - no locale lookup
  - integer pesewas in, with anything else (a float, NaN or an unsafe integer) rejected
  - unit tests covering zero, negatives, large values and every rounding-free boundary
- **Symbol:**
  - `GH₵` (U+20B5) in the interface
  - `GHS` on documents, exports and anything an accountant or customer keeps
- **Weight:** always three decimals with a `kg` suffix, never locale dependent.
- **Not applicable:** a value that does not apply renders as an en dash (`–`, U+2013).
- **Translation layer:** wired in F0b, as the brief requires, for labels only. Numbers and currency never go through it.

## Proposed detail, awaiting owner confirmation

The owner's decision did not fix spacing or the sign. F0b uses this unless the owner changes it:

- **Interface:** `GH₵1,234.50` and `-GH₵1,234.50`, with no space after the symbol.
- **Documents and exports:** `GHS 1,234.50` and `-GHS 1,234.50`, with a space after the code.
- **Minus:** ASCII hyphen-minus (U+002D) before the symbol, so exports parse in any spreadsheet.

## Consequences

- Any money or weight on screen goes through these functions. Lint can enforce this later by banning `toLocaleString` and `Intl.NumberFormat` in `packages/` and `apps/`.
- F0b checks that U+20B5 renders on the target devices (Android 9 system fonts). If it does not, that is raised with the owner before choosing a fallback.
