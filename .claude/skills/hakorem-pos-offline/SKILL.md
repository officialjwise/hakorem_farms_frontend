---
name: hakorem-pos-offline
description: Use when building or changing any POS screen, driver screen, shift, offline queue, sync, service worker or anything that must survive a dropped connection. Fires on sale entry, tender, hold and recall, proof of delivery and any code that totals a cart locally. Enforces client-generated ids, an idempotent queue, server-wins reconciliation and the network-off test.
---

# The counter keeps working when the network does not

Read `docs/SHARED_BRIEF.md` (hard constraint 9, "Integrity and reliability", the offline scenario in "System acceptance scenarios") and `docs/BUILD_PROMPT.md` (F9 and F13). The conflict rules are the backend's, in `../backend/docs/OFFLINE_SYNC.md`. Read that file; do not restate or guess it.

## What exists today, and what does not

- **Built in F1:** the POS shell (`apps/console/src/shells/PosShell.tsx`), the barcode focus trap (`pos/useBarcodeTrap.ts`, ADR 0014, proved with a real Dialog in `e2e/specs/console/pos-barcode-dialog.spec.ts`), and the offline indicator. The service worker is a minimal no-cache stub (ADR 0013).
- **Not built yet:** the IndexedDB queue, the local cart total, the sale screens (**F9**), and the service worker strategy and the fifty-transaction test (**F13**). Do not describe or import them before then.
- Available now in `packages/ui`: the touch-sized `lg` Button, `Dialog` for confirmations, `useToast`, `ErrorState`, `StatusBadge`, and the compact density the POS runs in.

## Rules (they hold from the first POS line)

1. **The POS shell is offline first from the first line of code**, not retrofitted.
2. **Client-generated UUIDv7 ids** on every offline transaction, so a sync retry is naturally idempotent. The queue sends the id as the idempotency key.
3. **The queue is persisted in IndexedDB**, survives a reload, and replays in order. It holds at least 500 transactions and works for 8 hours offline.
4. **The server is always authoritative.** The one place the frontend totals is the POS offline cart. That calculation is ported from the backend's rules, carries its own test suite asserting **exact pesewa values**, and is reconciled server-side on sync. If the two disagree the server wins and the difference is **flagged to a human**, never silently absorbed.
5. **Stock conflicts surface.** A sale that took stock negative while offline is flagged for a person, not resolved quietly.
6. **Money paths confirm first.** Any write to money or stock shows the exact amounts in a `Dialog` before it is queued, because an accidental tap at a busy counter is the realistic failure.
7. **A failed or queued sale stays visible.** A queued sale shows as queued (`StatusBadge` with icon and words), and a failed sync leaves persistent on-screen text. A toast is never the only record (ADR 0006).
8. **Defaults:** compact density, light theme (A-F0-03), large touch targets, keyboard first. A Tooltip never carries information on touch (ADR 0004).
9. **Focus.** The barcode field must keep receiving scans. Radix owns the Dialog focus trap and focus return; the real POS focus trap is `useBarcodeTrap` (ADR 0014); it acts after Radix and never overrides it. Never build a stand-in.

## The test that matters

Disconnect, run fifty POS transactions, reconnect. Exactly fifty land, no duplicates appear, and any stock conflict is shown to a person. Use a Playwright spec with the network disabled, not a mocked `fetch`.

## Correct

```ts
// Rules, not code that exists today: the id is made once, at the moment of intent.
const sale = { id: uuidv7(), lines, tender, createdAt: now() };
await queue.enqueue(sale); // persisted in IndexedDB before anything else
await sync.flush(); // retried safely: the server dedupes on sale.id
```

## Incorrect

```ts
// An id made on retry, an in-memory queue, a silent local override of the server's total.
let pending = [];
async function pay(cart) {
  pending.push({ id: Math.random(), total: cart.lines.reduce((s, l) => s + l.qty * l.price, 0) });
  const res = await fetch('/api/sales', { method: 'POST', body: JSON.stringify(pending[0]) });
  if (res.ok) pending.shift();
}
```

The id changes on retry (a duplicate sale), the queue dies on reload, the total uses float arithmetic with no test, and a server disagreement would be swallowed.
