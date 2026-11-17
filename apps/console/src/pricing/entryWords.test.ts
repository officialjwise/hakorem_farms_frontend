import { describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { entryWords } from './PriceListVersionScreen';

type Entry = components['schemas']['PriceListEntry'];

const words: Record<string, string> = {
  'entry.perUnit': 'per {{unit}}',
  'entry.minQty': 'from {{qty}}',
  'entry.minQtyBoth': 'from {{qty}} ({{base}} in the base unit)',
};
const t = (key: string, options: Record<string, unknown> = {}) =>
  (words[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
const units = {
  name: (code: string) => (code === 'CRATE' ? 'Crate' : 'Unit'),
  places: () => 0 as const,
};

const entry = (change: Partial<Entry>): Entry =>
  ({
    product: { id: 'p', sku: 'EGG-0003', name: 'Eggs, big' },
    grade: null,
    weightBand: null,
    basis: 'PER_UNIT',
    uom: 'CRATE',
    minQty: '0.000',
    minQtyBase: '0.000',
    ...change,
  }) as Entry;

describe('a price line names its selling unit and its break in that unit (2.1.0)', () => {
  it("shows a crate break with the API's own figure in the base unit, never one worked out", () => {
    expect(entryWords(entry({ minQty: '10.000', minQtyBase: '300.000' }), t, units)).toEqual([
      'per Crate',
      'from 10 Crate (300 in the base unit)',
    ]);
  });
  it('shows a single egg with no break as its unit alone', () => {
    expect(entryWords(entry({ uom: 'UNIT' }), t, units)).toEqual(['per Unit']);
  });
  it('names no unit on a per-kilogram price', () => {
    expect(entryWords(entry({ basis: 'PER_KG', uom: 'KG' }), t, units)).toEqual([]);
  });
});
