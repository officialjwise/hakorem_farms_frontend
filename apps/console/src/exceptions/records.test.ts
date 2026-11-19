import { describe, expect, it } from 'vitest';
import { byUrgency, recordPath } from './records';

describe('the exception report orders items, and finds each record its screen', () => {
  const item = (id: string, severity: string, raisedAt: string, reviewed = false) => ({
    id,
    severity,
    raisedAt,
    reviewed,
  });

  it('puts urgent first, then review, then information; unreviewed before reviewed; newest first', () => {
    const items = [
      item('info', 'INFO', '2026-11-19T09:00:00Z'),
      item('review-old', 'REVIEW', '2026-11-19T08:00:00Z'),
      item('urgent-reviewed', 'URGENT', '2026-11-19T12:00:00Z', true),
      item('review-new', 'REVIEW', '2026-11-19T10:00:00Z'),
      item('unknown', 'SOMETHING_NEW', '2026-11-19T13:00:00Z'),
      item('urgent', 'URGENT', '2026-11-19T07:00:00Z'),
    ];
    expect(byUrgency(items, (i) => i.reviewed).map((i) => i.id)).toEqual([
      'urgent',
      'urgent-reviewed',
      'review-new',
      'review-old',
      'info',
      'unknown',
    ]);
    // The API's list is not changed in place.
    expect(items[0]?.id).toBe('info');
  });

  it('links a record that has a screen, and none for one that has not', () => {
    expect(recordPath('SALES_ORDER', 'abc')).toBe('/orders/abc');
    expect(recordPath('MORTALITY_RECORD', 'abc')).toBe('/mortality/abc');
    expect(recordPath('RECEIPT', 'abc')).toBe('/billing-documents/abc');
    expect(recordPath('DRIVER_CASH_RECONCILIATION', 'abc')).toBeNull();
    expect(recordPath('constructor', 'abc')).toBeNull();
    expect(recordPath('QUOTE', 'a/b')).toBe('/quotes/a%2Fb');
  });
});
