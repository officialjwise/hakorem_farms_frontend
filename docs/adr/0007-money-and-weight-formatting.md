# 0007. Money and weight are formatted by our own rules, never by locale

- Status: accepted (owner confirmed 2026-11-13)
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

The storefront renders on the server and the client. `Intl.NumberFormat` depends on the runtime's ICU data, which differs between Node, Chrome and Android WebView versions. A total rendered one way on the server and another way on the client is an invoice that reads two ways, the failure this system exists to prevent.

## Decision

### Rules

- **No locale formatting for money:** `Intl.NumberFormat` and `toLocaleString` are not used for money.
- **Formatters:** money is formatted by functions in `packages/ui`, starting with `formatMoney(pesewas)`.
- **Input:** integer pesewas only. A float, NaN or an unsafe integer is rejected, not rounded.
- **Decimals:** always two, by explicit rules with no locale lookup.
- **Minus:** ASCII hyphen-minus (U+002D), before the symbol or code.
- **Tests:** zero, negatives and large values.

### Three contexts

| Context                                                                                                   | Format                                                                                                                                | Example        | Example, negative |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------- |
| Interface (screens, POS, storefront)                                                                      | `GH₵`, no space, comma thousands, two decimals                                                                                        | `GH₵1,234.50`  | `-GH₵1,234.50`    |
| Documents (invoices, receipts, quotes, statements, anything a customer or accountant keeps as a document) | `GHS`, one space, comma thousands, two decimals                                                                                       | `GHS 1,234.50` | `-GHS 1,234.50`   |
| CSV and spreadsheet exports                                                                               | Bare number: no symbol, no thousands separator, two decimals. The currency is named in the column header, for example `Amount (GHS)`. | `1234.50`      | `-1234.50`        |

Exports carry a bare number because a cell reading `GHS 1,234.50` imports as text and will not sum, which makes the export useless to an accountant.

### Weight and empty values

- **Weight:** always three decimals with a `kg` suffix (`38.400 kg`), never locale dependent. In CSV exports it is a bare number (`38.400`), with the unit in the column header, for example `Weight (kg)`.
- **Not applicable:** a value that does not apply renders as an en dash (`–`, U+2013).

### The cedi sign

- `GH₵` is U+20B5. Older Android system fonts cover it unreliably, so the glyph ships with the page rather than depending on the device.
- **Mechanism:** a glyph-only face subset to U+20B5, with an OFL-licensed source such as Noto Sans. It is declared with `@font-face` and `unicode-range: U+20B5` and listed first in the font stack.
  - The browser downloads it only when the glyph appears, at about a kilobyte, and all other text keeps the system stack (ADR 0001).
  - It lives in the shared `packages/ui` stylesheet, so the console and POS (Android tablets at the counter) get it as well as the storefront.
- **Proof:** a Storybook story renders `GH₵1,234.50` in the subset face and asserts the glyph comes from it.
- **Fallback:** if the subset face fails, fall back to `GH¢` (U+00A2, the cent sign). Every font carries it, and the business's own print material already uses it. The interface never falls back to `GHS`.

### Numbers do not go through translation

The translation layer (ADR 0008) is for labels only. Numbers and currency never pass through it.

## Pending, do not implement

- **Negatives in parentheses:** whether statements and ledger reports should show negatives in parentheses (`(1,234.50)`) rather than with a minus. This is an open question for the owner's accountant. Until it is answered, every context uses the minus sign as above.

## Consequences

- Any money or weight on screen, in a document or in an export goes through these functions, chosen by context. Lint can later ban `toLocaleString` and `Intl.NumberFormat` in `packages/` and `apps/`.
- Document rendering itself is server-side (backend), so the backend applies the same document rules. The frontend's document formatter exists for previews and must match the backend to the character.
