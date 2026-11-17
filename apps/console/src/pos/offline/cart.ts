/**
 * The offline cart's arithmetic: the one place the frontend totals (BUILD_PROMPT, "Two rules that matter
 * more than they look"). It is ported from the backend's rule, ADR-0001 "Money is integer pesewas, rounded
 * half-up once per line": a line's one rounded figure is `half_up(unit_price × quantity)`, with the
 * quantity in thousandths (`"8.000"` is 8000) or, for a price per kilogram, the weight in grams; and a
 * document's total is the sum of its line integers, never recomputed from another total. Every figure is a
 * `bigint` while it is worked out; the contract's `Pesewas` (a safe integer) is what goes in and comes out.
 *
 * The server re-prices every synced sale. These figures are what the till shows and what the customer pays
 * at the counter; the sync reads the server's total back and a difference is flagged (sync.ts), never
 * absorbed. A price list whose prices exclude tax would need the levies added on top: the offline pack does
 * not yet say which kind its prices are (CR-031), so the till treats them as the price the customer pays
 * (A-F9-02).
 */
import type { components } from '@hakorem/api-client';

type Schemas = components['schemas'];
export type PriceBasis = Schemas['PriceBasis'];
export type WeightSource = Schemas['WeightSource'];
export type OfflinePolicy = Schemas['OfflinePolicy'];

/** One line of a sale as the till holds it, before it becomes a `CounterSaleLine`. */
export interface CartLine {
  /** A local key, so the same product can be on two lines. */
  key: string;
  productId: string;
  productName: string;
  /** The unit the line is sold and priced in: the product's `saleUom`, or the selling unit chosen. */
  saleUom: string;
  /**
   * CR-038, requested (ADR 0046): the selling unit chosen at the till, a crate or a single egg, sent on the
   * sale line. Absent or null is the product's `saleUom`, and nothing is sent. Optional, so a cart held
   * before it existed still reads.
   */
  soldInUom?: string | null;
  priceBasis: PriceBasis;
  taxCategoryId: string;
  /** A serialised animal or lot, by its stock unit. */
  stockUnitId: string | null;
  stockUnitIdentifier: string | null;
  gradeId: string | null;
  /** Three places: `"1.000"`. */
  quantity: string;
  /** Three places, or null when nothing was weighed. Required for a price per kilogram. */
  weightKg: string | null;
  weightSource: WeightSource | null;
  listUnitPricePesewas: number;
  floorUnitPricePesewas: number;
  ceilingUnitPricePesewas: number;
  agreedUnitPricePesewas: number;
  varianceReasonCode: string | null;
}

const THREE_PLACES = /^(\d+)\.(\d{3})$/;
const THOUSAND = 1000n;
const MAX_PESEWAS = BigInt(Number.MAX_SAFE_INTEGER);

/** A three-place decimal string as an integer count of thousandths: `"38.400"` is 38,400. */
export function thousandths(value: string): bigint {
  const match = THREE_PLACES.exec(value);
  if (match === null) throw new Error(`"${value}" is not a three-place decimal.`);
  return BigInt(match[1] ?? '0') * THOUSAND + BigInt(match[2] ?? '0');
}

/** ADR-0001: `half_up(n / d)` for non-negative integers is `(2n + d) div 2d`. */
export function halfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error('half_up takes non-negative integers.');
  return (2n * numerator + denominator) / (2n * denominator);
}

function toPesewas(value: bigint): number {
  if (value < 0n || value > MAX_PESEWAS) throw new Error('The amount is outside the pesewa range.');
  return Number(value);
}

/** What the unit price multiplies on this line, in thousandths: the weight for a price per kilogram. */
export function multiplier(line: Pick<CartLine, 'priceBasis' | 'quantity' | 'weightKg'>): bigint {
  if (line.priceBasis === 'PER_KG') {
    if (line.weightKg === null) throw new Error('A price per kilogram needs a weight.');
    return thousandths(line.weightKg);
  }
  return thousandths(line.quantity);
}

function lineAt(unitPricePesewas: number, line: Parameters<typeof multiplier>[0]): bigint {
  return halfUp(BigInt(unitPricePesewas) * multiplier(line), THOUSAND);
}

/** The line's amount at the agreed price: its one rounded figure. */
export function lineAmount(line: CartLine): number {
  return toPesewas(lineAt(line.agreedUnitPricePesewas, line));
}

/** The line at the list price, as the price list resolves it. */
export function lineListAmount(line: CartLine): number {
  return toPesewas(lineAt(line.listUnitPricePesewas, line));
}

/**
 * The discount this line gives away against the list price, in pesewas (zero for a price at or above the
 * list): the list line less the agreed line, each rounded once, as the server posts it to price variance.
 */
export function lineDiscount(line: CartLine): number {
  const difference =
    lineAt(line.listUnitPricePesewas, line) - lineAt(line.agreedUnitPricePesewas, line);
  return difference > 0n ? toPesewas(difference) : 0;
}

/** The sale's total: the sum of its line integers. */
export function cartTotal(lines: readonly CartLine[]): number {
  return toPesewas(
    lines.reduce((sum, line) => sum + lineAt(line.agreedUnitPricePesewas, line), 0n),
  );
}

/** The discounts of these lines together. */
export function cartDiscount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => toPesewas(BigInt(sum) + BigInt(lineDiscount(line))), 0);
}

/** Why the till refuses an agreed price. The server re-checks it at sync (OFFLINE_SYNC 9.6). */
export type PriceRefusal =
  'BELOW_FLOOR' | 'ABOVE_CEILING' | 'REASON_REQUIRED' | 'OVER_LINE_LIMIT' | 'OVER_SHIFT_LIMIT';

/**
 * Checks an agreed price against the band and the cashier's cached limits (OFFLINE_SYNC 5.1 and 9.6): it
 * must sit inside the band; any price other than the list price needs a reason; and the discount may not
 * pass the per-line limit, nor take the shift's discounts so far past the per-shift limit.
 */
export function checkAgreedPrice(
  line: CartLine,
  policy: Pick<
    OfflinePolicy,
    'priceOverrideLimitPerLinePesewas' | 'priceOverrideLimitPerShiftPesewas'
  >,
  shiftDiscountSoFarPesewas: number,
): PriceRefusal | null {
  if (line.agreedUnitPricePesewas < line.floorUnitPricePesewas) return 'BELOW_FLOOR';
  if (line.agreedUnitPricePesewas > line.ceilingUnitPricePesewas) return 'ABOVE_CEILING';
  if (
    line.agreedUnitPricePesewas !== line.listUnitPricePesewas &&
    line.varianceReasonCode === null
  ) {
    return 'REASON_REQUIRED';
  }
  const discount = BigInt(lineDiscount(line));
  if (discount > BigInt(policy.priceOverrideLimitPerLinePesewas)) return 'OVER_LINE_LIMIT';
  if (
    BigInt(shiftDiscountSoFarPesewas) + discount >
    BigInt(policy.priceOverrideLimitPerShiftPesewas)
  ) {
    return 'OVER_SHIFT_LIMIT';
  }
  return null;
}

/** A non-cash tender as the cashier enters it: the amount applied to the sale. */
export interface OtherTender {
  paymentMethodId: string;
  amountPesewas: number;
  /** A provider payment already cleared online (mobile money, card): the tender references it. */
  paymentId?: string;
  /**
   * Mobile money taken offline on a supervisor's PIN, not verified (OFFLINE_SYNC 5.3 and 9.9): the
   * contract's `UnverifiedMobileMoneyInput`. Offered only where the pack lists the method offline.
   */
  unverifiedMobileMoney?: {
    payerPhone: string;
    network: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
    providerReference?: string;
    approvedById: string;
  };
}

export interface TenderSplit {
  /** What cash pays: the total less the other tenders. */
  cashAppliedPesewas: number;
  /** The cash handed over less what cash pays; zero when short. */
  changePesewas: number;
  /** How much is still to pay; zero when covered. */
  shortPesewas: number;
  /** The other tenders come to more than the total. Refused: change is given in cash only. */
  otherExceedsTotal: boolean;
}

/**
 * Splits a sale's total between other tenders (mobile money, card) and cash (FR-POS split tender). The
 * other tenders are applied as entered; cash pays the rest, and change comes from the cash handed over.
 */
export function splitTender(
  totalPesewas: number,
  others: readonly OtherTender[],
  cashHandedPesewas: number,
): TenderSplit {
  const total = BigInt(totalPesewas);
  const other = others.reduce((sum, tender) => sum + BigInt(tender.amountPesewas), 0n);
  if (other > total) {
    return { cashAppliedPesewas: 0, changePesewas: 0, shortPesewas: 0, otherExceedsTotal: true };
  }
  const cashDue = total - other;
  const handed = BigInt(cashHandedPesewas);
  return {
    cashAppliedPesewas: toPesewas(cashDue),
    changePesewas: toPesewas(handed > cashDue ? handed - cashDue : 0n),
    shortPesewas: toPesewas(handed < cashDue ? cashDue - handed : 0n),
    otherExceedsTotal: false,
  };
}

/** A quantity typed as a whole count (`3`) or a decimal (`2.5`), as the contract's three-place string. */
export function toThreePlaces(typed: string): string | null {
  const match = /^(\d{1,9})(?:\.(\d{1,3}))?$/.exec(typed.trim());
  if (match === null) return null;
  return `${String(BigInt(match[1] ?? '0'))}.${(match[2] ?? '').padEnd(3, '0')}`;
}
