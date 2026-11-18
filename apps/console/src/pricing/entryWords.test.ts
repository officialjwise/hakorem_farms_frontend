import { describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { entryWords } from './PriceListVersionScreen';

type Entry = components['schemas']['PriceListEntry'];

const words: Record<string, string> = {
  'entry.perUnit': 'per {{unit}}',
  'entry.minQty': 'from {{qty}}',
  'entry.minQtyBoth': 'from {{qty}} ({{base}})',
};
const t = (key: string, options: Record<string, unknown> = {}) =>
  (words[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
const names: Record<string, [string, string]> = {
  CRATE: ['crate', 'crates'],
  EGG: ['egg', 'eggs'],
};
const units = {
  places: () => 0 as const,
  one: (code: string) => names[code]?.[0] ?? code,
  after: (code: string, quantity: string) =>
    (quantity === '1.000' ? names[code]?.[0] : names[code]?.[1]) ?? code,
};

const entry = (change: Partial<Entry>): Entry =>
  ({
    product: { id: 'p', sku: 'EGG-0003', name: 'Eggs, big' },
    grade: null,
    weightBand: null,
    basis: 'PER_UNIT',
    uom: 'CRATE',
    baseUom: 'EGG',
    minQty: '0.000',
    minQtyBase: '0.000',
    ...change,
  }) as Entry;

describe('a price line names its selling unit and its break in that unit (2.1.0)', () => {
  it("shows a crate break with the API's own figure in its base unit (CR-041), never one worked out", () => {
    expect(entryWords(entry({ minQty: '10.000', minQtyBase: '300.000' }), t, units)).toEqual([
      'per crate',
      'from 10 crates (300 eggs)',
    ]);
  });
  it('shows a single egg with no break as its unit alone', () => {
    expect(entryWords(entry({ uom: 'EGG' }), t, units)).toEqual(['per egg']);
  });
  it('says a break of one in the singular (2.9.0)', () => {
    expect(entryWords(entry({ minQty: '1.000', minQtyBase: '30.000' }), t, units)).toEqual([
      'per crate',
      'from 1 crate (30 eggs)',
    ]);
  });
  it('names no unit on a per-kilogram price', () => {
    expect(entryWords(entry({ basis: 'PER_KG', uom: 'KG' }), t, units)).toEqual([]);
  });
});
