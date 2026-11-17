# F10h: contract 2.5.0 synced, nothing else built

- **Session:** F10 continued, on branch `claude/dreamy-tesla-xvaxnz`, from `main` at `4df43d7` (F10g merged as PR #26).
- **Date:** 2026-11-17
- **Scope:** the 2.5.0 sync, and nothing more.
- **Why so small:** the session opened asking for the supplier invoice screens. F10g had already built them, and they are on `main`:
  - the invoice against its order and receipt, with the three-way match;
  - approval and payment, each with its own approver;
  - the claim, settled or turned into a credit note;
  - the supplier's account.
- **The owner's answer (2026-11-17):** asked what to do instead, the owner chose to sync 2.5.0 and stop. No till screen is touched.

## Contract 2.5.0 (additive, backend `bef5f1c`)

B9b's first part. Twelve planned till operations move into code with the shapes 1.0.0 planned:

- registers: `listRegisters`, `createRegister`, `updateRegister`;
- shifts: `listShifts`, `openShift`, `getShift`;
- cash movements: `listShiftCashMovements`, `recordCashMovement`;
- reports: `getShiftXReport`, `getShiftZReport`;
- the close: `closeShift`, `approveShiftClose`.

The rest of the till is still planned: devices, held sales, the offline pack, the counter sale and the offline sync.

**Behaviour the till's shift screens must read**, when they are built:

- `recordCashMovement` needs a reason for every kind.
- A cash drop's witness holds `pos.shift.close.approve` and is neither the cashier nor the caller.
- `openedAt` and `occurredAt` must be within 300 seconds of the server's clock.
- Expected cash and over or short are null until the count is declared.
- `approveShiftClose` asks for a fresh step-up.

**The seed now grants eight till permissions:** `pos.sale.create`, `pos.shift.open`, `pos.shift.close`, `pos.shift.read`, `pos.shift.report`, `pos.cash.move`, `pos.register.read` and `pos.shift.close.approve`. Their tripwires in `fakeRoles.test.ts` failed, as they were written to. Their lines are deleted, and the fake already matched the seed for each. Still not seeded: `pos.device.read`, `pos.device.enrol` and `pos.shift.force_close`.

## What did not land

- **The eggs' unit is still `UNIT`, and units have no plural names.** The screens still say "540 Unit". When the rename lands, follow F10g's opening message item 1.
- **CR-032, CR-033, CR-038 and CR-042 did not land.** `landed.ts` still compiles, so every switch stays.
- **CR-043 and CR-044 are unanswered.**

## Moved from the mock to the real API

**None.** The shift operations exist in code on the backend, but nothing is deployed and no screen calls them.

## Contract requests added or changed

None.

## Decisions recorded

None.

## Gates, each run on its own

| Check                                                     | Exit | Count                                                                                                     |
| --------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`                                    | 0    |                                                                                                           |
| `typecheck` (inside `sync-contract`)                      | 0    |                                                                                                           |
| `sync-contract:check`                                     | 0    |                                                                                                           |
| `test:unit`                                               | 0    | console 287 (was 295: the eight tripwires deleted), data 31, api-client 30, ui 900, storefront 34, i18n 6 |
| `test:integration`                                        | 0    | console 249, storefront 15                                                                                |
| `budget:console`                                          | 0    | till 247.1 of 250 kB (unchanged); back office 279.8 of 300 kB (unchanged)                                 |
| `test:e2e`, full run                                      | 0    | 286 of 286 in 5.2 minutes                                                                                 |
| `tokens:check`, `fonts:check`, `icons:check`, `test:a11y` | n/r  | not run: no token, font, icon or `packages/ui` change                                                     |

## For the owner

1. **The till's shifts can be built against the contract now:** opening a shift, cash in and out, the X and Z reports and the blind close. The till has 2.9 kB of room left, so its refusal words must load on demand first (F10g's item 2).
2. F10g's four questions still stand. The main one is who approves a claim's credit note when the Owner raises the claim.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, docs/sessions/F10g-supplier-invoices-and-payment.md and
docs/sessions/F10h-contract-2-5-0-sync.md. Read ADR 0046, 0049 and 0052.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.5.0, then follow
   item 1 of F10g's opening message (the eggs' unit and plurals, CR-042, CR-038, CR-039, CR-032, CR-033,
   CR-043, CR-044).
2. Load the till's refusal rule words on demand (F10g item 2). Only then, if the owner wants it, build the
   till's shifts against 2.5.0: open, cash movements, X and Z reports, the blind close and its approval.
   Every new till screen loads lazily.
3. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
```
