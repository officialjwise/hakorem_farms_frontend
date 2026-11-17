# 0050. Show readable ids with a copy button, and never a UUID

- Status: accepted (owner, 2026-11-17: the F10b report's item 4, applied once contract 2.0.0 landed)
- Date: 2026-11-17
- Session: F10d

## Context

Contract 2.0.0 (backend ADR-0072, ADR-0073) replaced `customerNo` and `supplierNo` with `publicId` (`cus_…`, `sup_…`), made the SKU the server's, and removed the product barcode. The owner's rules for ids on screen: no screen shows a UUID; products show their SKU, customers and suppliers their public id; search takes both; long ids use the monospace face and wrap at 360 px; every id gets a copy button; existing readable codes stay. No component in `packages/ui` copied anything.

## Options considered

1. **A copy button written into each screen.** The clipboard call, its failure and its words repeated everywhere.
2. **One display component, `CopyId`, in `packages/ui`.** The id in the monospace face, wrapping anywhere, and a ghost icon `Button` that writes it to the clipboard and says "Copied" or why it could not in a `status` beside it. Its strings are props (ADR 0008); it adds no stylesheet, context or variant mechanism, only Button.

## Decision

Option 2.

- **`CopyId`** (`packages/ui/src/components/copy-id`): `value`, `copyLabel`, `copiedLabel`, `failedLabel`, each required. A blank value or button name is refused at compile time and at render. Stories: Default, Short, Long (wraps in a 160 px column), Copied, CopyFailed, KeyboardPath.
- **`ReadableId`** (`apps/console/src/lib/ReadableId.tsx`) gives it the console's words. It is used where a detail screen names a product's SKU or a customer's or supplier's public id: the product facts, a statement, a billing document, a goods receipt, an animal's supplier, and the supplier list.
- **In lists and pickers** the SKU or public id is plain monospace text beside the name (stock lines, stock take, transfers, processing inputs and outputs, price list entries, returns, the supplier filter), with the copy button on the detail screen.
- **No UUID on screen or on paper.** Removed: the till receipt's "Sale id" (screen and printer; the sale reference stays), the payment id a cleared mobile money tender fell back to, the order and original document ids a billing document fell back to, the archive's template version id, and the audit event's record and branch ids. Ids stay in addresses (`/products/{id}`), keys and request parameters, which are not shown.
- **Search:** `listCustomers` and `listSuppliers` find a record by its public id in `q` (2.0.0), so the customer and supplier searches say they take one; `listProducts?q=` takes a name or the start of a SKU.

## Consequences

- A person reads, copies and searches by the same code the server gives.
- **Two things still carry a UUID, for the owner** (F10d report): the digital receipt link CR-033 builds from the sale's client id, which the owner asked to be printed in full as text; and the request references (`correlationId`) error states show for support.
- Revisit if the backend gives another readable code (an order number for every order, a token for the receipt link).
