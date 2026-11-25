import { describe, expect, it } from 'vitest';
import { payableAtTill } from './invoicePayment';

const settlement = (outstandingPesewas: number) =>
  ({ outstandingPesewas }) as Parameters<typeof payableAtTill>[0]['settlement'];
const ORDER = {
  id: '019a7b52-6c10-7e3a-9d41-2f8b0c6a1e55',
  docType: 'SALES_ORDER',
  number: 'ORD-2026-DDW-000031',
};

describe('what the till takes cash for (payInvoiceAtTill, 2.26.0 and 2.36.0)', () => {
  it('takes an issued invoice with something outstanding', () => {
    expect(
      payableAtTill({
        kind: 'INVOICE',
        status: 'ISSUED',
        order: null,
        settlement: settlement(42560),
      }),
    ).toBeNull();
  });

  it("takes an issued receipt of an order with something outstanding: a guest's collection balance", () => {
    expect(
      payableAtTill({ kind: 'RECEIPT', status: 'ISSUED', order: ORDER, settlement: settlement(1) }),
    ).toBeNull();
    expect(
      payableAtTill({ kind: 'RECEIPT', status: 'ISSUED', order: null, settlement: settlement(1) }),
    ).toBe('RECEIPT_NOT_OF_ORDER');
  });

  it('says why it does not ask for anything else', () => {
    expect(
      payableAtTill({
        kind: 'CREDIT_NOTE',
        status: 'ISSUED',
        order: null,
        settlement: settlement(5),
      }),
    ).toBe('NOT_AN_INVOICE');
    expect(
      payableAtTill({ kind: 'PROFORMA', status: 'ISSUED', order: null, settlement: settlement(5) }),
    ).toBe('NOT_AN_INVOICE');
    expect(
      payableAtTill({ kind: 'INVOICE', status: 'DRAFT', order: null, settlement: settlement(5) }),
    ).toBe('NOT_ISSUED');
    expect(
      payableAtTill({ kind: 'INVOICE', status: 'ISSUED', order: null, settlement: settlement(0) }),
    ).toBe('SETTLED');
  });
});
