# 0049. Eggs are one product sold in two units, the crate and the egg, with stock held in eggs

- Status: accepted (owner, 2026-11-17, answering the F10b report's first question). Its screens wait for the backend's egg phase and its contract.
- Date: 2026-11-17
- Session: F10c

## Context

The business starts with eggs bought by the crate of 30 and resold. The till sells each product in its one sale unit (`OfflineProduct.saleUom`), and a sale line names no unit, so it cannot sell a single egg. The F10b report gave the owner two routes: a separate "Egg, single" product with its own stock and a screen to break a crate into 30, or one product whose sale line can name another of its units through its conversion (`createUomConversion` already exists). The second needs a contract change.

## Options considered

1. **Two products and a crate-breaking screen.** Two stocks to keep in step, and a movement nobody would remember to record at the counter.
2. **One product, two selling units, one stock.** What the owner decided.

## Decision

Option 2, as the owner set it out:

- **One product**, sold in two units, the crate and the egg. Not a separate product, and **no crate-breaking screen**.
- **Stock is held in eggs.** A crate sold takes 30 eggs from the same stock as 30 single eggs.
- **A price per selling unit.** The backend's egg phase builds this, so a crate can cost GHS 55.00 while 30 single eggs cost more; the price of a crate is never the egg price times 30 computed on the client. Every price, total and tax comes from the API (CLAUDE.md, the contract rule).
- **The frontend waits for that contract.** Nothing is built against a guessed shape: no requested module, no switch, until the egg phase's contract is synced and read.

## Consequences

- At the till and in the shop, the egg product offers two units, each with its own price from the pack or the catalogue, and a sale line carries the unit it was sold in. Quantities follow the contract's three-place strings and `formatQuantity`, never a float.
- Unit conversions (A-F4-05) stay read-only in the console unless the egg contract asks the console to set them.
- The egg screens come in their own session, after the backend's egg phase merges, in the owner's order: buying (purchase orders, the supplier on the goods receipt, breakage rejected at the door with a reason and a claim: CR-035, CR-036), then selling in two units, then bulk buyer prices (the F10c report's opening message).
- Revisit if the egg contract does not hold stock in the smallest unit.
