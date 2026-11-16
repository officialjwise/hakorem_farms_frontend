import { describe, expect, it } from 'vitest';
import {
  cartDiscount,
  cartTotal,
  checkAgreedPrice,
  halfUp,
  lineAmount,
  lineDiscount,
  lineListAmount,
  splitTender,
  thousandths,
  toThreePlaces,
  type CartLine,
} from './cart';

/** The figures are OFFLINE_SYNC.md's worked examples (section 9) and the contract's offline pack example. */
function line(overrides: Partial<CartLine>): CartLine {
  return {
    key: 'l1',
    productId: 'p',
    productName: 'Eggs, big, crate of 30',
    saleUom: 'CRATE',
    priceBasis: 'PER_UNIT',
    taxCategoryId: 't',
    stockUnitId: null,
    stockUnitIdentifier: null,
    gradeId: null,
    quantity: '1.000',
    weightKg: null,
    weightSource: null,
    listUnitPricePesewas: 6200,
    floorUnitPricePesewas: 6200,
    ceilingUnitPricePesewas: 6200,
    agreedUnitPricePesewas: 6200,
    varianceReasonCode: null,
    ...overrides,
  };
}

const POLICY = { priceOverrideLimitPerLinePesewas: 5000, priceOverrideLimitPerShiftPesewas: 15000 };

describe('half-up, once per line (ADR-0001)', () => {
  it('reads three-place strings as thousandths', () => {
    expect(thousandths('38.400')).toBe(38400n);
    expect(thousandths('0.001')).toBe(1n);
    expect(thousandths('8.000')).toBe(8000n);
    expect(() => thousandths('8')).toThrow();
    expect(() => thousandths('8.5')).toThrow();
    expect(() => thousandths('-1.000')).toThrow();
  });

  it('rounds an exact half up, one below down, one above up', () => {
    expect(halfUp(1500n, 1000n)).toBe(2n);
    expect(halfUp(1499n, 1000n)).toBe(1n);
    expect(halfUp(1501n, 1000n)).toBe(2n);
    expect(halfUp(0n, 1000n)).toBe(0n);
    expect(halfUp(2500n, 1000n)).toBe(3n);
    expect(() => halfUp(-1n, 1000n)).toThrow();
  });

  it('prices eight crates of eggs at 49,600 (section 9.3)', () => {
    expect(lineAmount(line({ quantity: '8.000' }))).toBe(49600);
  });

  it('prices a goat by the head at its agreed price (section 9.1): 125,000', () => {
    const goat = line({
      priceBasis: 'PER_HEAD',
      listUnitPricePesewas: 127500,
      floorUnitPricePesewas: 115000,
      ceilingUnitPricePesewas: 140000,
      agreedUnitPricePesewas: 125000,
      varianceReasonCode: 'REGULAR_CUSTOMER',
    });
    expect(lineAmount(goat)).toBe(125000);
    expect(lineListAmount(goat)).toBe(127500);
    expect(lineDiscount(goat)).toBe(2500);
  });

  it('prices beef by the kilogram on the weight, rounding the one figure half up', () => {
    // GHS 30.00 a kilogram, 15.250 kg: 3,000 × 15.250 = 45,750 exactly.
    const beef = line({
      priceBasis: 'PER_KG',
      quantity: '1.000',
      weightKg: '15.250',
      listUnitPricePesewas: 3000,
      floorUnitPricePesewas: 2200,
      ceilingUnitPricePesewas: 4333,
      agreedUnitPricePesewas: 3000,
    });
    expect(lineAmount(beef)).toBe(45750);
    // GHS 43.33 a kilogram, 1.255 kg: 4,333 × 1.255 = 5,437.915, so 5,438.
    expect(lineAmount({ ...beef, agreedUnitPricePesewas: 4333, weightKg: '1.255' })).toBe(5438);
    // 2,201 × 0.500 = 1,100.5 exactly: half up to 1,101.
    expect(lineAmount({ ...beef, agreedUnitPricePesewas: 2201, weightKg: '0.500' })).toBe(1101);
    // 2,201 × 0.499 = 1,098.299: 1,098.
    expect(lineAmount({ ...beef, agreedUnitPricePesewas: 2201, weightKg: '0.499' })).toBe(1098);
    expect(() => lineAmount({ ...beef, weightKg: null })).toThrow();
  });

  it('takes the discount on a weighed line as the list line less the agreed line, each rounded once', () => {
    // 3,000 × 1.255 = 3,765; 2,999 × 1.255 = 3,763.745, so 3,764. The discount is 1, not 1.255.
    const beef = line({
      priceBasis: 'PER_KG',
      weightKg: '1.255',
      listUnitPricePesewas: 3000,
      floorUnitPricePesewas: 2200,
      ceilingUnitPricePesewas: 4333,
      agreedUnitPricePesewas: 2999,
      varianceReasonCode: 'REGULAR_CUSTOMER',
    });
    expect(lineDiscount(beef)).toBe(1);
    expect(lineDiscount({ ...beef, agreedUnitPricePesewas: 3100 })).toBe(0);
  });

  it('totals a sale as the sum of its line integers (section 9.9: 31,000)', () => {
    expect(cartTotal([line({ quantity: '5.000' })])).toBe(31000);
    const lines = [
      line({ key: 'a', quantity: '2.000' }),
      line({
        key: 'b',
        priceBasis: 'PER_KG',
        weightKg: '1.255',
        listUnitPricePesewas: 4333,
        floorUnitPricePesewas: 2200,
        ceilingUnitPricePesewas: 4333,
        agreedUnitPricePesewas: 4333,
      }),
    ];
    // 12,400 + 5,438 = 17,838: the weighed line is rounded first, never the total.
    expect(cartTotal(lines)).toBe(17838);
    expect(cartTotal([])).toBe(0);
  });

  it('adds the discounts of a sale', () => {
    const goat = line({
      priceBasis: 'PER_HEAD',
      listUnitPricePesewas: 127500,
      floorUnitPricePesewas: 115000,
      ceilingUnitPricePesewas: 140000,
      agreedUnitPricePesewas: 123500,
      varianceReasonCode: 'REGULAR_CUSTOMER',
    });
    expect(cartDiscount([goat, { ...goat, key: 'g2', agreedUnitPricePesewas: 126000 }])).toBe(5500);
  });
});

describe('the agreed price against the band and the cached limits (section 9.6)', () => {
  const goat = line({
    priceBasis: 'PER_HEAD',
    listUnitPricePesewas: 127500,
    floorUnitPricePesewas: 115000,
    ceilingUnitPricePesewas: 140000,
    agreedUnitPricePesewas: 127500,
  });

  it('accepts the list price with no reason', () => {
    expect(checkAgreedPrice(goat, POLICY, 0)).toBeNull();
  });

  it('asks a reason for any other price, up or down', () => {
    expect(checkAgreedPrice({ ...goat, agreedUnitPricePesewas: 123500 }, POLICY, 0)).toBe(
      'REASON_REQUIRED',
    );
    expect(checkAgreedPrice({ ...goat, agreedUnitPricePesewas: 130000 }, POLICY, 0)).toBe(
      'REASON_REQUIRED',
    );
    expect(
      checkAgreedPrice(
        { ...goat, agreedUnitPricePesewas: 130000, varianceReasonCode: 'REGULAR_CUSTOMER' },
        POLICY,
        0,
      ),
    ).toBeNull();
  });

  it('accepts a discount of 4,000 within the cached 5,000 a line, and refuses 5,001', () => {
    const agreed = { ...goat, varianceReasonCode: 'REGULAR_CUSTOMER' };
    expect(checkAgreedPrice({ ...agreed, agreedUnitPricePesewas: 123500 }, POLICY, 0)).toBeNull();
    expect(checkAgreedPrice({ ...agreed, agreedUnitPricePesewas: 122500 }, POLICY, 0)).toBeNull();
    expect(checkAgreedPrice({ ...agreed, agreedUnitPricePesewas: 122499 }, POLICY, 0)).toBe(
      'OVER_LINE_LIMIT',
    );
  });

  it('refuses the discount that takes the shift past its 15,000', () => {
    const agreed = {
      ...goat,
      varianceReasonCode: 'REGULAR_CUSTOMER',
      agreedUnitPricePesewas: 123500,
    };
    expect(checkAgreedPrice(agreed, POLICY, 11000)).toBeNull();
    expect(checkAgreedPrice(agreed, POLICY, 11001)).toBe('OVER_SHIFT_LIMIT');
  });

  it('refuses a price outside the band', () => {
    const agreed = { ...goat, varianceReasonCode: 'REGULAR_CUSTOMER' };
    expect(checkAgreedPrice({ ...agreed, agreedUnitPricePesewas: 114999 }, POLICY, 0)).toBe(
      'BELOW_FLOOR',
    );
    expect(checkAgreedPrice({ ...agreed, agreedUnitPricePesewas: 140001 }, POLICY, 0)).toBe(
      'ABOVE_CEILING',
    );
  });
});

describe('split tender and change', () => {
  it('gives 5,000 change on 130,000 handed for 125,000 (section 9.1)', () => {
    expect(splitTender(125000, [], 130000)).toEqual({
      cashAppliedPesewas: 125000,
      changePesewas: 5000,
      shortPesewas: 0,
      otherExceedsTotal: false,
    });
  });

  it('splits 31,000 as 20,000 mobile money and 11,000 cash, 4,000 change on 15,000 (section 9.9)', () => {
    expect(splitTender(31000, [{ paymentMethodId: 'momo', amountPesewas: 20000 }], 15000)).toEqual({
      cashAppliedPesewas: 11000,
      changePesewas: 4000,
      shortPesewas: 0,
      otherExceedsTotal: false,
    });
  });

  it('says how much is still to pay when the cash is short', () => {
    expect(splitTender(49600, [], 49000).shortPesewas).toBe(600);
    expect(splitTender(49600, [], 49600)).toMatchObject({ changePesewas: 0, shortPesewas: 0 });
  });

  it('refuses other tenders that come to more than the total: change is cash only', () => {
    expect(
      splitTender(10000, [{ paymentMethodId: 'momo', amountPesewas: 10001 }], 0),
    ).toMatchObject({
      otherExceedsTotal: true,
    });
    expect(splitTender(10000, [{ paymentMethodId: 'momo', amountPesewas: 10000 }], 0)).toEqual({
      cashAppliedPesewas: 0,
      changePesewas: 0,
      shortPesewas: 0,
      otherExceedsTotal: false,
    });
  });
});

describe('a typed quantity', () => {
  it('becomes the contract three-place string', () => {
    expect(toThreePlaces('3')).toBe('3.000');
    expect(toThreePlaces('2.5')).toBe('2.500');
    expect(toThreePlaces(' 0.125 ')).toBe('0.125');
    expect(toThreePlaces('007')).toBe('7.000');
    expect(toThreePlaces('1.2345')).toBeNull();
    expect(toThreePlaces('-1')).toBeNull();
    expect(toThreePlaces('')).toBeNull();
  });
});
