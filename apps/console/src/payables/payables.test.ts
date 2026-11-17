import { describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { toInstant } from './instant';
import { varianceAllowed } from './presentation';

type S = components['schemas'];

const line = (matchReasons: string[]): S['SupplierInvoiceLine'] =>
  ({
    matchStatus: matchReasons.length === 0 ? 'MATCHED' : 'MISMATCH',
    matchReasons,
  }) as S['SupplierInvoiceLine'];

const invoice = (
  matchStatus: S['SupplierInvoice']['matchStatus'],
  ...lines: S['SupplierInvoiceLine'][]
): S['SupplierInvoice'] => ({ matchStatus, lines }) as S['SupplierInvoice'];

describe('asking to pay an invoice as invoiced (requestSupplierInvoiceVariance)', () => {
  it('is offered when every failing line fails on price or a levy only', () => {
    expect(varianceAllowed(invoice('MISMATCH', line(['PRICE_OUTSIDE_TOLERANCE']), line([])))).toBe(
      true,
    );
    expect(
      varianceAllowed(invoice('MISMATCH', line(['PRICE_OUTSIDE_TOLERANCE', 'LEVY_DIFFERS']))),
    ).toBe(true);
  });

  it('is not offered for goods not received, another product or no order line', () => {
    expect(
      varianceAllowed(
        invoice('MISMATCH', line(['QTY_EXCEEDS_RECEIVED', 'PRICE_OUTSIDE_TOLERANCE'])),
      ),
    ).toBe(false);
    expect(varianceAllowed(invoice('MISMATCH', line(['PRODUCT_DIFFERS'])))).toBe(false);
    expect(varianceAllowed(invoice('MISMATCH', line(['NO_ORDER_LINE'])))).toBe(false);
  });

  it('is not offered for an invoice that is not a mismatch', () => {
    expect(varianceAllowed(invoice('MATCHED', line([])))).toBe(false);
    expect(varianceAllowed(invoice('UNMATCHED', line([])))).toBe(false);
  });
});

describe('the time a payment was made', () => {
  it('is the day and the 24-hour time typed, in Accra, which is UTC', () => {
    expect(toInstant('2026-11-17', '14:30')).toBe('2026-11-17T14:30:00Z');
    expect(toInstant('2026-11-17', ' 09:05 ')).toBe('2026-11-17T09:05:00Z');
    expect(toInstant('2026-11-17', '00:00')).toBe('2026-11-17T00:00:00Z');
  });

  it('refuses anything that is not a day and an hour and minute', () => {
    expect(toInstant('2026-11-17', '2:30 pm')).toBeNull();
    expect(toInstant('2026-11-17', '24:00')).toBeNull();
    expect(toInstant('2026-11-17', '14:60')).toBeNull();
    expect(toInstant('', '14:30')).toBeNull();
  });
});
