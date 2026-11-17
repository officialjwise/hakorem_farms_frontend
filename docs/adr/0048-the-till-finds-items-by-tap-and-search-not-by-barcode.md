# 0048. The till finds items by tapping and searching; it has no barcode scanning

- Status: accepted (owner, 2026-11-17). Supersedes ADR 0014, and ADR 0004's "Barcode focus story" bullet.
- Date: 2026-11-17
- Session: F10 (owner's decisions)

## Context

Since F1 the till's shell carried a barcode field with a focus trap (ADR 0014) so a scanner's keystrokes always landed in it, and F9 sold by barcode or by an animal's tag typed into that field. The business is starting with eggs bought from a supplier and resold, and has no scanners at its counters. The owner decided (2026-11-17): remove barcode scanning at the till; products are found by tapping and searching; weight capture stays; the meat pack label screen stays exactly as built, barcode included, because meat is future work.

## Options considered

1. **Keep the barcode field for later.** A field that takes every keystroke and holds focus is a cost on every screen for hardware the counter does not have.
2. **Remove scanning at the till; tap and search.** What the owner decided.

## Decision

Option 2.

- **Removed:** the barcode field in `PosShell`, its focus trap (`useBarcodeTrap`), the scan events (`scans.ts`), the till's barcode lookup and the dialog that asked which of two products shared a barcode, and the e2e proof of the trap with a Dialog (`pos-barcode-dialog.spec.ts`).
- **Finding an item at the till** (`pos/sale/catalogue.ts`, `findInPack`): tap a tile, or search by name, SKU, or an animal's or lot's tag (the search box's results list matching animals and lots first; an exact tag the pack says is not for sale is refused in words). A barcode typed into the search finds nothing.
- **Kept:** weight capture on weighed lines; the barcode field on the product record and every back office screen that shows or prints a barcode, including the meat pack label screen (`labels/LabelsScreen.tsx`, `processing/PacksSection.tsx`) and `@hakorem/ui`'s `Barcode`.
- Dialogs at the till keep Radix's own focus trap and focus return (ADR 0004); nothing at the till now competes with them.

## Consequences

- No screen fights a focus trap; the search box and the PIN field take focus like any field.
- Selling an animal or a lot means tapping its product and choosing the tag, or typing the tag into search.
- Revisit if the shop buys scanners. A scanner that types into the search box and presses Enter would need only a "pick the single exact match on Enter" rule, not the old trap.
