import type { QuantityPlaces } from '@hakorem/ui';
import { useApiAllPages } from '../data/api';

/** `Quantity` in the contract: a non-negative decimal string with exactly three places. */
export const QUANTITY = /^(0|[1-9][0-9]{0,10})\.[0-9]{3}$/;

/**
 * What a person typed ("34", "29.75") as the contract's three-place `Quantity` ("34.000", "29.750"), by
 * padding the string. No number is ever made from it. Null for anything that is not digits with at most
 * three places.
 */
export function toQuantity(typed: string): string | null {
  const match = /^(\d+)(?:\.(\d{0,3}))?$/.exec(typed.trim());
  if (match === null) return null;
  const whole = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const quantity = `${whole}.${(match[2] ?? '').padEnd(3, '0')}`;
  return QUANTITY.test(quantity) ? quantity : null;
}

/**
 * Which of two contract quantities is larger, by comparing their digits as integers of thousandths. Both
 * are three-place strings (`Quantity`), so this is a comparison of the API's own figures, never arithmetic
 * on them: nothing is added, subtracted or rounded.
 */
export function compareQuantity(a: string, b: string): -1 | 0 | 1 {
  const x = BigInt(a.replace('.', ''));
  const y = BigInt(b.replace('.', ''));
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * How far apart two three-place quantities are, as a three-place string: the gap between what was sent
 * and what is being typed, shown while the person types (owner, 2026-11-15: input feedback, not the
 * business calculation). Exact, on integers of thousandths. What posts, and the variance on record, are
 * the API's.
 */
export function gapBetween(a: string, b: string): string {
  const x = BigInt(a.replace('.', ''));
  const y = BigInt(b.replace('.', ''));
  const gap = x > y ? x - y : y - x;
  const digits = gap.toString().padStart(4, '0');
  return `${digits.slice(0, -3)}.${digits.slice(-3)}`;
}

/** A display precision the unit declares (`Uom.displayDecimals`, CR-003), as `QuantityDisplay` takes it. */
export function asPlaces(decimals: number | undefined): QuantityPlaces {
  return decimals === 0 || decimals === 1 || decimals === 2 ? decimals : 3;
}

/**
 * Display precision and name per unit code, from the unit list. The precision is the unit's own
 * `displayDecimals` (CR-003, contract 1.7.0); a stock line that carries `uomDisplayDecimals` uses that
 * instead. An unknown code shows three places, so a stray fraction is never hidden.
 */
export function useUnits() {
  // Seeded and short (ADR 0028): `reference`.
  const units = useApiAllPages(
    'listUnitsOfMeasure',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const byCode = new Map((units.data?.items ?? []).map((unit) => [unit.code, unit]));
  return {
    places: (code: string): QuantityPlaces => asPlaces(byCode.get(code)?.displayDecimals),
    name: (code: string): string => byCode.get(code)?.name ?? code,
  };
}

/** One unit a line can be counted in: the product's base unit, or a unit it converts from. */
export interface LineUnit {
  code: string;
  /** For a converted unit, how many base units it is, as the API states it (`UomConversion.factor`). */
  factor: string | null;
}

/**
 * The units a product's line may be entered in (contract 2.2.0): its base unit first, then each live
 * conversion's `fromUom`, from `listUomConversions`. The server converts; this only offers the choice and
 * shows the conversion the API holds ("a crate is 30 eggs"), never a quantity worked out from it.
 */
export function useLineUnits(product: { id: string; baseUom: string } | null): {
  units: LineUnit[];
  loading: boolean;
} {
  // A product's conversions change rarely: `reference` (ADR 0028).
  const conversions = useApiAllPages(
    'listUomConversions',
    { query: { productId: product?.id ?? '', limit: 100 } },
    { staleClass: 'reference', enabled: product !== null },
  );
  if (product === null) return { units: [], loading: false };
  const converted = (conversions.data?.items ?? [])
    .filter((c) => c.product.id === product.id && c.toUom === product.baseUom)
    .map((c) => ({ code: c.fromUom, factor: c.factor }))
    .filter(
      (u, i, all) => u.code !== product.baseUom && all.findIndex((v) => v.code === u.code) === i,
    );
  return {
    units: [{ code: product.baseUom, factor: null }, ...converted],
    loading: conversions.isPending,
  };
}
