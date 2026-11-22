import { describe, expect, it } from 'vitest';
import { quantityText, unitName } from './units';

/** The pack's units as `getOfflinePack`'s example gives them (2.17.0, CR-051). */
const UOMS = [
  { code: 'CRATE', name: 'Crate', singularName: 'crate', pluralName: 'crates', displayDecimals: 0 },
  { code: 'EGG', name: 'Egg', singularName: 'egg', pluralName: 'eggs', displayDecimals: 0 },
  { code: 'HEAD', name: 'Head', singularName: 'head', pluralName: 'head', displayDecimals: 0 },
];

describe("the till's units in words (CR-051)", () => {
  it('says one in the singular and more in the plural, from the pack', () => {
    expect(quantityText('6.000', 'EGG', UOMS)).toBe('6 eggs');
    expect(quantityText('1.000', 'CRATE', UOMS)).toBe('1 crate');
    expect(quantityText('2.000', 'CRATE', UOMS)).toBe('2 crates');
    expect(quantityText('3.000', 'HEAD', UOMS)).toBe('3 head');
  });

  it('says the code in lower case for a unit the pack does not name', () => {
    expect(quantityText('6.000', 'BUNCH', UOMS)).toBe('6 bunch');
    expect(quantityText('6.000', 'EGG')).toBe('6 egg');
    expect(unitName('EGG', UOMS, 'one')).toBe('egg');
    expect(unitName('EGG', UOMS, 'many')).toBe('eggs');
  });
});
