import { describe, expect, it } from 'vitest';
import { countChanges, entryKey, previewChanges, toInput, type PriceListEntry } from './preview';

function entry(over: Partial<PriceListEntry> & { id: string; productId?: string }): PriceListEntry {
  const { productId = 'goat', ...rest } = over;
  return {
    product: { id: productId, sku: `SKU-${productId}`, name: productId },
    grade: null,
    weightBand: { id: 'band-m', code: 'GOAT-M', minKg: '18.000', maxKg: '28.000' },
    basis: 'PER_HEAD',
    listPricePesewas: 85000,
    floorPricePesewas: 70000,
    ceilingPricePesewas: 98000,
    quoteOnly: false,
    minQty: '0.000',
    minQtyBase: '0.000',
    uom: 'HEAD',
    currency: 'GHS',
    ...rest,
  };
}

describe('previewChanges', () => {
  it('lines the draft up with the active version and marks each line, changes first', () => {
    const active = [
      entry({ id: 'a1' }),
      entry({ id: 'a2', productId: 'sheep' }),
      entry({ id: 'a3', productId: 'pig' }),
    ];
    const draft = [
      entry({ id: 'd1', listPricePesewas: 90000 }),
      entry({ id: 'd2', productId: 'sheep' }),
      entry({ id: 'd4', productId: 'duck' }),
    ];
    const rows = previewChanges(active, draft);
    expect(rows.map((r) => [r.kind, r.now?.id ?? null, r.next?.id ?? null])).toEqual([
      ['changed', 'a1', 'd1'],
      ['added', null, 'd4'],
      ['removed', 'a3', null],
      ['unchanged', 'a2', 'd2'],
    ]);
    expect(countChanges(rows)).toEqual({ added: 1, changed: 1, removed: 1, unchanged: 1 });
  });

  it('keeps the exact pesewa values the API sent on both sides', () => {
    const [row] = previewChanges(
      [entry({ id: 'a', floorPricePesewas: 70001 })],
      [entry({ id: 'd', floorPricePesewas: 70002 })],
    );
    expect(row?.now?.floorPricePesewas).toBe(70001);
    expect(row?.next?.floorPricePesewas).toBe(70002);
    expect(row?.kind).toBe('changed');
  });

  it('a change to quote-only or to the basis is a change', () => {
    expect(
      previewChanges([entry({ id: 'a' })], [entry({ id: 'd', quoteOnly: true })])[0]?.kind,
    ).toBe('changed');
    expect(
      previewChanges([entry({ id: 'a' })], [entry({ id: 'd', basis: 'PER_KG' })])[0]?.kind,
    ).toBe('changed');
  });

  it('a different grade, band or quantity break is a different line, not a change', () => {
    const rows = previewChanges(
      [entry({ id: 'a' })],
      [entry({ id: 'd', grade: { id: 'grade-a', code: 'A', name: 'Grade A' } })],
    );
    expect(rows.map((r) => r.kind)).toEqual(['added', 'removed']);
    expect(entryKey(entry({ id: 'x', minQty: '10.000' }))).not.toBe(entryKey(entry({ id: 'x' })));
  });

  it('a crate and a single egg of the same product are two lines', () => {
    const egg = entry({ id: 'e', productId: 'egg', uom: 'UNIT', listPricePesewas: 250 });
    const crate = entry({ id: 'c', productId: 'egg', uom: 'CRATE', listPricePesewas: 6000 });
    expect(entryKey(egg)).not.toBe(entryKey(crate));
    expect(previewChanges([egg, crate], [egg, crate]).map((r) => r.kind)).toEqual([
      'unchanged',
      'unchanged',
    ]);
  });

  it('with no active version every line is added', () => {
    expect(previewChanges([], [entry({ id: 'd' })]).map((r) => r.kind)).toEqual(['added']);
  });
});

describe('toInput', () => {
  it('sends the line back as the contract input, leaving out an absent grade', () => {
    expect(toInput(entry({ id: 'a' }))).toEqual({
      productId: 'goat',
      weightBandId: 'band-m',
      basis: 'PER_HEAD',
      listPricePesewas: 85000,
      floorPricePesewas: 70000,
      ceilingPricePesewas: 98000,
      quoteOnly: false,
      minQty: '0.000',
      uom: 'HEAD',
    });
  });

  it("keeps a crate's price a crate's: the selling unit and the break as entered go back", () => {
    const crate = entry({ id: 'c', uom: 'CRATE', minQty: '10.000', minQtyBase: '300.000' });
    expect(toInput(crate)).toMatchObject({ uom: 'CRATE', minQty: '10.000' });
  });

  it('a PER_KG entry names no unit, which the contract refuses on it', () => {
    expect(toInput(entry({ id: 'k', basis: 'PER_KG', uom: 'KG' }))).not.toHaveProperty('uom');
  });
});
