import { describe, expect, it } from 'vitest';
import { approvers, fromContract, priceApprovers, purposeOf, type PinVerifier } from '../pin/pin';
import { checkAgreedPrice, lineDiscount, type CartLine } from './cart';
import { lineApprovalRecord, toOfflineSaleLine } from './sale';

/** G-0142's own band (2.28.0): list GH₵650.00, floor GH₵400.00, ceiling GH₵900.00. */
function goat(overrides: Partial<CartLine> = {}): CartLine {
  return {
    key: 'l1',
    productId: 'goat',
    productName: 'Goat',
    saleUom: 'HEAD',
    priceBasis: 'PER_HEAD',
    taxCategoryId: 't',
    stockUnitId: '019a7a8f-5f3a-70a1-a5d9-12ebaa838bc9',
    stockUnitIdentifier: 'G-0142',
    gradeId: null,
    quantity: '1.000',
    weightKg: '26.400',
    weightSource: 'ESTIMATE',
    listUnitPricePesewas: 65000,
    floorUnitPricePesewas: 40000,
    ceilingUnitPricePesewas: 90000,
    agreedUnitPricePesewas: 50000,
    varianceReasonCode: 'REGULAR_CUSTOMER',
    ...overrides,
  };
}

/** The pack's policy example: GH₵50.00 off a line and GH₵200.00 on a shift for the cashier. */
const POLICY = { priceOverrideLimitPerLinePesewas: 5000, priceOverrideLimitPerShiftPesewas: 20000 };

const APPROVAL = {
  approvedById: '019a7a86-4f35-7afd-b035-b8ab03a83188',
  approvedByPinVersion: 4,
  approvedByName: 'Kwabena Owusu',
  approvedAt: '2026-11-23T10:00:00.000Z',
  approvedPricePesewas: 50000,
  limitPesewas: 20000,
};

function person(id: string, role: 'OPERATOR' | 'SUPERVISOR', limit: number, locked = false) {
  return fromContract({
    principal: { id, displayName: id },
    role,
    version: 1,
    algorithm: 'PBKDF2-SHA256',
    iterations: 600000,
    pinSalt: locked ? null : 'c2FsdHNhbHRzYWx0c2FsdA==',
    pinHash: locked ? null : 'aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=',
    wrongTries: locked ? 5 : 0,
    locked,
    priceOverrideLimitPerLinePesewas: limit,
  });
}

describe("a supervisor's PIN approves a price beyond the cashier's limit (2.17.0)", () => {
  it("refuses GH₵150.00 off for the cashier alone, and lets the supervisor's approval of that price through", () => {
    expect(lineDiscount(goat())).toBe(15000);
    expect(checkAgreedPrice(goat(), POLICY, 0)).toBe('OVER_LINE_LIMIT');
    expect(checkAgreedPrice(goat({ overrideApproval: APPROVAL }), POLICY, 0)).toBeNull();
    // Past the shift's limit too: the supervisor approved this line.
    expect(checkAgreedPrice(goat({ overrideApproval: APPROVAL }), POLICY, 19000)).toBeNull();
  });

  it('holds the approval to its own price, and to the supervisor’s own limit, and never past the band', () => {
    // The price changed after the PIN: asked again.
    expect(
      checkAgreedPrice(
        goat({ agreedUnitPricePesewas: 45000, overrideApproval: APPROVAL }),
        POLICY,
        0,
      ),
    ).toBe('OVER_LINE_LIMIT');
    const small = { ...APPROVAL, limitPesewas: 10000 };
    expect(checkAgreedPrice(goat({ overrideApproval: small }), POLICY, 0)).toBe('OVER_LINE_LIMIT');
    const below = { ...APPROVAL, approvedPricePesewas: 39000 };
    expect(
      checkAgreedPrice(goat({ agreedUnitPricePesewas: 39000, overrideApproval: below }), POLICY, 0),
    ).toBe('BELOW_FLOOR');
  });

  it('offers only supervisors who are not the cashier, not locked, and whose limit covers the discount', () => {
    const verifiers: PinVerifier[] = [
      person('cashier-supervisor', 'SUPERVISOR', 50000),
      person('manager', 'SUPERVISOR', 20000),
      person('small', 'SUPERVISOR', 10000),
      person('locked', 'SUPERVISOR', 50000, true),
      person('operator', 'OPERATOR', 50000),
    ];
    expect(
      priceApprovers(verifiers, 'cashier-supervisor', 15000).map((v) => v.principalId),
    ).toEqual(['manager']);
    expect(approvers(verifiers, 'PRICE_OVERRIDE').map((v) => v.principalId)).not.toContain(
      'operator',
    );
    expect(purposeOf('PRICE_OVERRIDE')).toBe('APPROVAL');
  });

  it('sends the approval on the offline line only for the price it approved, and keeps it for the queue', () => {
    expect(toOfflineSaleLine(goat({ overrideApproval: APPROVAL })).overrideApproval).toEqual({
      approvedById: APPROVAL.approvedById,
      approvedByPinVersion: 4,
    });
    expect(
      toOfflineSaleLine(goat({ agreedUnitPricePesewas: 45000, overrideApproval: APPROVAL })),
    ).not.toHaveProperty('overrideApproval');
    expect(toOfflineSaleLine(goat())).not.toHaveProperty('overrideApproval');
    expect(lineApprovalRecord(goat({ overrideApproval: APPROVAL }))).toEqual({
      approval: 'PRICE_OVERRIDE',
      principalId: APPROVAL.approvedById,
      displayName: 'Kwabena Owusu',
      verifierVersion: 4,
      at: APPROVAL.approvedAt,
    });
  });
});
