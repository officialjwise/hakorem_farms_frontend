import { describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { repriced } from './HeldSales';
import { newLine, stockUnitBand, unpricedReason } from './catalogue';
import type { OfflinePack } from '../offline/types';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

const band = (list: number, floor: number, ceiling: number) => ({
  listPricePesewas: list,
  floorPricePesewas: floor,
  ceilingPricePesewas: ceiling,
  basis: 'PER_HEAD' as const,
});

/** A live goat: no single band on the product (a live animal has none). */
const GOAT = {
  product: { id: 'goat', sku: 'LIV-GOAT', name: 'Goat' },
  saleUom: 'HEAD',
  taxCategoryId: 't',
  priceBasis: 'PER_HEAD',
  priceBand: null,
  priceListEntryId: null,
  quoteOnly: false,
  taxInclusive: true,
  tileCategory: 'Livestock',
} as unknown as OfflineProduct;

/** Tomatoes sold from a lot, at the product's own band. */
const TOMATOES = {
  ...GOAT,
  product: { id: 'tomatoes', sku: 'VEG-TOM', name: 'Tomatoes, crate' },
  saleUom: 'CRATE',
  priceBasis: 'PER_UNIT',
  priceBand: { ...band(65000, 55000, 75000), basis: 'PER_UNIT' },
} as unknown as OfflineProduct;

const unit = (fields: Partial<OfflineStockUnit>): OfflineStockUnit =>
  ({
    id: 'u',
    identifier: 'G-0142',
    productId: 'goat',
    locationId: 'l',
    gradeId: null,
    lastWeightKg: '26.400',
    lastWeighedAt: null,
    lastWeightSource: 'SCALE',
    sellable: true,
    priceListEntryId: null,
    priceBand: null,
    unpricedReason: null,
    ...fields,
  }) as OfflineStockUnit;

describe('an animal at its own band (2.28.0, CR-052)', () => {
  it("prices an animal from its own band, never its product's", () => {
    const goat = unit({ priceBand: band(120000, 90000, 150000) });
    expect(stockUnitBand(GOAT, goat)?.listPricePesewas).toBe(120000);
    const line = newLine(GOAT, goat);
    expect(line).toMatchObject({
      stockUnitId: 'u',
      listUnitPricePesewas: 120000,
      floorUnitPricePesewas: 90000,
      ceilingUnitPricePesewas: 150000,
      agreedUnitPricePesewas: 120000,
      weightKg: '26.400',
    });
  });

  it("sells a lot at its product's band", () => {
    const lot = unit({ identifier: 'LOT-7', productId: 'tomatoes' });
    expect(stockUnitBand(TOMATOES, lot)?.listPricePesewas).toBe(65000);
    expect(unpricedReason(TOMATOES, lot)).toBeNull();
  });

  it('gives no line for an animal the pack cannot price, and says why', () => {
    const unweighed = unit({ lastWeightKg: null, unpricedReason: 'MISSING_GRADE_OR_WEIGHT' });
    expect(newLine(GOAT, unweighed)).toBeNull();
    expect(unpricedReason(GOAT, unweighed)).toBe('MISSING_GRADE_OR_WEIGHT');
    expect(unpricedReason(GOAT, unit({}))).toBe('NO_PRICE');
  });

  it('re-prices a recalled animal at its own band now, and drops one the pack no longer prices', () => {
    const goat = unit({ priceBand: band(120000, 90000, 150000) });
    const line = newLine(GOAT, goat);
    if (line === null) throw new Error('priced');
    const now = {
      products: [GOAT],
      stockUnits: [unit({ priceBand: band(130000, 100000, 160000) })],
    };
    expect(repriced([line], now as unknown as OfflinePack)[0]?.listUnitPricePesewas).toBe(130000);
    const gone = { products: [GOAT], stockUnits: [] };
    expect(repriced([line], gone as unknown as OfflinePack)).toEqual([]);
  });
});
