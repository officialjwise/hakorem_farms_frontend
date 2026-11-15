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
 * Display precision and name per unit code. Until CR-003 puts `displayDecimals` on the unit, a COUNT unit
 * shows whole numbers and a WEIGHT or VOLUME unit three places; an unknown code shows three, so a stray
 * fraction is never hidden (CR-003, "Until this lands").
 */
export function placesFor(kind: 'COUNT' | 'WEIGHT' | 'VOLUME' | undefined): QuantityPlaces {
  return kind === 'COUNT' ? 0 : 3;
}

export function useUnits() {
  // Seeded and short (ADR 0028): `reference`.
  const units = useApiAllPages(
    'listUnitsOfMeasure',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const byCode = new Map((units.data?.items ?? []).map((unit) => [unit.code, unit]));
  return {
    places: (code: string): QuantityPlaces => placesFor(byCode.get(code)?.kind),
    name: (code: string): string => byCode.get(code)?.name ?? code,
  };
}
