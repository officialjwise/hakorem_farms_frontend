---
name: hakorem-money-ui
description: Use when displaying or capturing money, weight or quantity anywhere in the UI, including a price, total, amount input, weight field, quantity, price band, table column, document preview or CSV export. Fires on formatMoney, formatWeight, MoneyDisplay, MoneyInput, WeightInput, GH₵, GHS, pesewas, kilograms, toLocaleString or Intl. Enforces integer pesewas, formatting only at the edge, no float arithmetic, GHS presentation and weight to three places.
---

# Money, weight and quantity in the UI

Read `docs/adr/0007-money-and-weight-formatting.md`. The frontend **formats, it does not compute.** Totals, tax, margin and distributions come from the API.

## The rules

1. **Integer pesewas in and out.** `Pesewas` in the contract is a non-negative int64 (at most 2^53 - 1). Never a float, never a decimal string. Direction (credit or debit, in or out) travels in a **separate field**; a negative amount on screen comes from that field, never from the number. `MoneyDisplay` takes `negative` for this.
2. **Weight and quantity are three-place strings** (`Kilograms`, `Quantity`: `"38.400"`). Never a JSON number, never parsed to a JS number. `WeightInput` holds a string.
3. **Format at the edge, with our own rules.** No `Intl.NumberFormat`, no `toLocaleString`: ICU differs between runtimes and a server-rendered total must equal the client's. Use `formatMoney`, `formatWeight` and `formatQuantity`.
4. **Pick the context:**

   | Context     | Money          | Weight         | Where                                               |
   | ----------- | -------------- | -------------- | --------------------------------------------------- |
   | `interface` | `GH₵1,234.50`  | `1,250.500 kg` | Screens, POS, storefront                            |
   | `document`  | `GHS 1,234.50` | `1,250.500 kg` | Anything a customer or accountant keeps             |
   | `export`    | `1234.50`      | `1250.500`     | CSV and spreadsheets. Currency in the column header |

   Negatives use an ASCII minus. Parentheses for negatives is an open question for the owner's accountant: do not implement it.

5. **Not applicable is an en dash** (`NOT_APPLICABLE`), and an empty cell in exports. **A null can carry meaning** (a null `thresholdPesewas` means "always"), so read the field's description before showing a dash. A possibly-null display requires `notApplicableLabel`, so a screen reader hears words.
6. **Components, not strings:** `MoneyDisplay`, `WeightDisplay`, `QuantityDisplay`, `PriceBandDisplay` for display; `MoneyInput` (integer pesewas or null) and `WeightInput` (three-place string or null) for capture. Put the unit in the Field label too ("Weight (kg)"), because the on-screen affix is decorative.
7. **Cost is never shown as price** (CR-001). Cost fields (`unitCostPesewas`, `valueAtCostPesewas`, `accumulatedCostPesewas`) and price fields (`PriceBand`) are different columns with different labels. `PriceBandDisplay` shows selling prices only.
8. **Totals come from the API.** Never sum rows or multiply quantity by price in a screen.
9. **The cedi sign ships with the page** (a 1.3 KB glyph face for U+20B5). If it ever fails, fall back to `GH¢`, never to `GHS` in the interface.
10. **Quantity display** keeps the API's three places (`3.000 head`). Whether a countable unit shows `3 head` is an open owner question; do not trim.

## Confirmation

Anything that writes money or stock confirms first, showing the exact amounts, in a `Dialog`.

## Correct

```tsx
<Field label={t('price.label')}>
  <MoneyInput value={price} onValueChange={setPrice} />
</Field>

<MoneyDisplay pesewas={line.amountPesewas} negative={line.direction === 'OUT'} />
<WeightDisplay kilograms={animal.lastWeightKg} notApplicableLabel={t('common.notApplicable')} />
<TableCell numeric label={t('stock.valueAtCost')}>
  <MoneyDisplay pesewas={row.valueAtCostPesewas} />
</TableCell>
```

## Incorrect

```tsx
// Locale formatting, a float, a client total, and a cost shown under a price heading.
const total = rows.reduce((sum, r) => sum + r.qty * (r.unitCostPesewas / 100), 0);
<span>{total.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}</span>
<TableHead>Price</TableHead>
<TableCell>{(row.valueAtCostPesewas / 100).toFixed(2)}</TableCell>
```

It uses `toLocaleString`, divides pesewas into a float, computes the total on the client, and labels a cost column "Price".
