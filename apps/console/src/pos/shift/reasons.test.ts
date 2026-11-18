import { describe, expect, it } from 'vitest';
import { reasonsFor } from './reasons';

const reason = (code: string, requiresNote = false) => ({
  code,
  domain: 'CASH_MOVEMENT',
  description: code,
  requiresNote,
  lossAccountGroup: null,
});

describe('cash movement reasons by kind (2.5.0)', () => {
  const held = [
    reason('FUEL_PAYOUT', true),
    reason('FLOAT_TOP_UP'),
    reason('BANK_DEPOSIT'),
    reason('SAFE_DROP'),
    reason('FUEL_PAYOUT', true),
    { ...reason('SAFE_DROP'), domain: 'VOID' },
  ];

  it('offers a drop only SAFE_DROP and a pay-in only FLOAT_TOP_UP', () => {
    expect(reasonsFor('CASH_DROP', held).map((r) => r.code)).toEqual(['SAFE_DROP']);
    expect(reasonsFor('PAY_IN', held).map((r) => r.code)).toEqual(['FLOAT_TOP_UP']);
  });

  it('offers a pay-out the expenses the till holds, once each, and never a reason that fits no kind', () => {
    expect(reasonsFor('PAY_OUT', held).map((r) => r.code)).toEqual(['FUEL_PAYOUT']);
    expect(
      ['CASH_DROP', 'PAY_OUT', 'PAY_IN'].flatMap((kind) =>
        reasonsFor(kind as 'CASH_DROP', held).map((r) => r.code),
      ),
    ).not.toContain('BANK_DEPOSIT');
  });

  it('offers nothing for a kind whose reasons the till has not read', () => {
    expect(reasonsFor('CASH_DROP', [reason('FLOAT_TOP_UP')])).toEqual([]);
  });
});
