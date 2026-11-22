/**
 * The till's units in words, from its pack (`OfflinePack.uoms`, CR-051, 2.17.0), with no React, so the
 * printer's encoder says them too.
 */
import type { components } from '@hakorem/api-client';
import { formatQuantity } from '@hakorem/ui';

type OfflineUom = components['schemas']['OfflineUom'];

/**
 * A unit's name from the pack (`OfflinePack.uoms`, CR-051, 2.17.0): "egg" for one, "eggs" for more. A
 * unit the pack does not name is said by its code in lower case, as before.
 */
export function unitName(
  uom: string,
  uoms: readonly OfflineUom[] | undefined,
  form: 'one' | 'many',
): string {
  const named = uoms?.find((unit) => unit.code === uom);
  if (named === undefined) return uom.toLowerCase();
  return form === 'one' ? named.singularName : named.pluralName;
}

/** Exactly one, so the unit is said in the singular: "1 crate", never "1 crates". */
function isOne(quantity: string): boolean {
  return /^1(\.0*)?$/.test(quantity);
}

/** A quantity in its unit: a count for countable units, three places for weight (ADR 0007). */
export function quantityText(quantity: string, uom: string, uoms?: readonly OfflineUom[]): string {
  return `${formatQuantity(quantity, { places: 0 })} ${unitName(uom, uoms, isOne(quantity) ? 'one' : 'many')}`;
}
