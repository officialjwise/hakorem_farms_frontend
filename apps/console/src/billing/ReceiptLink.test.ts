import { describe, expect, it } from 'vitest';
import { mayHoldReceiptLink } from './ReceiptLink';

const ORDER = { id: '019a7c1e-2b40-7c11-8a3e-5d0b6f1e2a77', docType: 'SALES_ORDER', number: null };

describe("a receipt that may hold the till's link (revokeReceiptLink, 2.26.0)", () => {
  it('is an issued receipt of a counter sale the till synced', () => {
    expect(
      mayHoldReceiptLink({
        kind: 'RECEIPT',
        status: 'ISSUED',
        order: ORDER,
        syncedFromOffline: true,
      }),
    ).toBe(true);
  });

  it('is never an online sale, a draft, an invoice or a receipt with no order', () => {
    expect(
      mayHoldReceiptLink({
        kind: 'RECEIPT',
        status: 'ISSUED',
        order: ORDER,
        syncedFromOffline: false,
      }),
    ).toBe(false);
    expect(mayHoldReceiptLink({ kind: 'RECEIPT', status: 'ISSUED', order: ORDER })).toBe(false);
    expect(
      mayHoldReceiptLink({
        kind: 'RECEIPT',
        status: 'DRAFT',
        order: ORDER,
        syncedFromOffline: true,
      }),
    ).toBe(false);
    expect(
      mayHoldReceiptLink({
        kind: 'INVOICE',
        status: 'ISSUED',
        order: ORDER,
        syncedFromOffline: true,
      }),
    ).toBe(false);
    expect(
      mayHoldReceiptLink({
        kind: 'RECEIPT',
        status: 'ISSUED',
        order: null,
        syncedFromOffline: true,
      }),
    ).toBe(false);
  });
});
