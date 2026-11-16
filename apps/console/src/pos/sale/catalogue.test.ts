import { describe, expect, it } from 'vitest';
import { EMPTY_META, type OfflinePack, type TillSnapshot } from '../offline/types';
import {
  matchScan,
  newLine,
  searchProducts,
  sellingBlock,
  tenderMethods,
  tiles,
} from './catalogue';

/** A slice of the contract's `getOfflinePack` example. */
const PACK = {
  register: { id: 'r', code: 'T1', name: 'Shop till 1' },
  generatedAt: '2026-11-16T06:55:00Z',
  validUntil: '2026-11-17T06:55:00Z',
  priceListVersionIds: [],
  taxSchemeVersionId: 'x',
  taxCells: [],
  products: [
    {
      product: { id: 'goat', sku: 'LIV-GOAT', name: 'Goat' },
      saleUom: 'HEAD',
      barcode: null,
      taxCategoryId: 't',
      priceBasis: 'PER_HEAD',
      priceBand: {
        listPricePesewas: 85000,
        floorPricePesewas: 12000,
        ceilingPricePesewas: 195000,
        basis: 'PER_HEAD',
      },
      priceListEntryId: null,
      quoteOnly: false,
      tileCategory: 'Live animals',
    },
    {
      product: { id: 'eggs', sku: 'EGG-BIG', name: 'Eggs, big, crate of 30' },
      saleUom: 'CRATE',
      barcode: '603470011',
      taxCategoryId: 't',
      priceBasis: 'PER_UNIT',
      priceBand: {
        listPricePesewas: 6000,
        floorPricePesewas: 6000,
        ceilingPricePesewas: 6000,
        basis: 'PER_UNIT',
      },
      priceListEntryId: null,
      quoteOnly: false,
      tileCategory: 'Eggs',
    },
    {
      product: { id: 'yam', sku: 'PRD-YAM', name: 'Yam, tuber' },
      saleUom: 'TUBER',
      barcode: '603470011',
      taxCategoryId: 't',
      priceBasis: 'PER_UNIT',
      priceBand: {
        listPricePesewas: 2500,
        floorPricePesewas: 2000,
        ceilingPricePesewas: 3000,
        basis: 'PER_UNIT',
      },
      priceListEntryId: null,
      quoteOnly: false,
      tileCategory: 'Fresh produce',
    },
    {
      product: { id: 'beef', sku: 'MEAT-BEEF', name: 'Beef, 15 kg pack' },
      saleUom: 'PACK',
      barcode: '603490011',
      taxCategoryId: 't',
      priceBasis: 'PER_KG',
      priceBand: {
        listPricePesewas: 3000,
        floorPricePesewas: 2200,
        ceilingPricePesewas: 4333,
        basis: 'PER_KG',
      },
      priceListEntryId: null,
      quoteOnly: false,
      tileCategory: 'Meat',
    },
  ],
  stockUnits: [
    {
      id: 'u1',
      identifier: 'G-0142',
      productId: 'goat',
      locationId: 'l',
      gradeId: null,
      lastWeightKg: '26.400',
      sellable: true,
    },
    {
      id: 'u3',
      identifier: 'G-0163',
      productId: 'goat',
      locationId: 'l',
      gradeId: null,
      lastWeightKg: '22.150',
      sellable: false,
    },
  ],
  paymentMethods: [
    { id: 'cash', code: 'CASH', name: 'Cash', kind: 'CASH' },
    { id: 'momo', code: 'MOMO', name: 'Mobile money', kind: 'MOBILE_MONEY' },
  ],
  reasonCodes: [],
  policy: {
    maxOfflineHours: 8,
    maxQueuedSales: 500,
    offlineTenderMethodIds: ['cash'],
    priceOverrideLimitPerLinePesewas: 5000,
    priceOverrideLimitPerShiftPesewas: 20000,
  },
  currency: 'GHS',
} as unknown as OfflinePack;

const snapshot = (over: Partial<TillSnapshot> = {}): TillSnapshot => ({
  device: null,
  pack: PACK,
  shift: null,
  meta: { ...EMPTY_META, lastReachedServerAt: '2026-11-16T08:00:00Z' },
  entries: [],
  held: [],
  syncLog: [],
  ...over,
});

describe('scanning against the pack', () => {
  it('finds an animal by its tag, case and spaces aside, with its last weight as an estimate', () => {
    const match = matchScan(PACK, ' g-0142 ');
    expect(match.kind).toBe('unit');
    if (match.kind !== 'unit') return;
    const line = newLine(match.product, match.unit);
    expect(line).toMatchObject({
      stockUnitId: 'u1',
      stockUnitIdentifier: 'G-0142',
      quantity: '1.000',
      weightKg: '26.400',
      weightSource: 'ESTIMATE',
      agreedUnitPricePesewas: 85000,
    });
  });

  it('refuses an animal the pack says is not sellable', () => {
    expect(matchScan(PACK, 'G-0163').kind).toBe('unsellable');
  });

  it('finds a product by barcode, and asks when two share one', () => {
    expect(matchScan(PACK, '603490011')).toMatchObject({ kind: 'product' });
    const several = matchScan(PACK, '603470011');
    expect(several.kind).toBe('several');
    expect(several.kind === 'several' ? several.products.map((p) => p.product.id) : []).toEqual([
      'eggs',
      'yam',
    ]);
    expect(matchScan(PACK, '999')).toEqual({ kind: 'none', code: '999' });
  });

  it('searches by every word typed and groups the tiles by category', () => {
    expect(searchProducts(PACK, 'beef pack').map((p) => p.product.id)).toEqual(['beef']);
    expect(searchProducts(PACK, '  ')).toEqual([]);
    expect(tiles(PACK).map((group) => group.category)).toEqual([
      'Live animals',
      'Eggs',
      'Fresh produce',
      'Meat',
    ]);
  });
});

describe('when the till may sell (OFFLINE_SYNC 5.1)', () => {
  const now = new Date('2026-11-16T09:00:00Z');
  it('sells with a fresh pack', () => {
    expect(sellingBlock(snapshot(), now)).toBeNull();
  });
  it('stops with no pack, after validUntil, after eight hours unreached, and with 500 sales queued', () => {
    expect(sellingBlock(snapshot({ pack: null }), now)).toBe('NO_PACK');
    expect(sellingBlock(snapshot(), new Date('2026-11-17T06:56:00Z'))).toBe('PACK_EXPIRED');
    expect(sellingBlock(snapshot(), new Date('2026-11-16T16:00:01Z'))).toBe('OFFLINE_TOO_LONG');
    expect(sellingBlock(snapshot(), new Date('2026-11-16T16:00:00Z'))).toBeNull();
    const full = Array.from({ length: 500 }, (_, i) => ({
      kind: 'SALE',
      localStatus: 'QUEUED',
      id: String(i),
    }));
    expect(sellingBlock(snapshot({ entries: full as never }), now)).toBe('QUEUE_FULL');
  });
  it('offers only the policy methods offline: cash', () => {
    expect(tenderMethods(PACK, false).map((m) => m.id)).toEqual(['cash']);
    expect(tenderMethods(PACK, true).map((m) => m.id)).toEqual(['cash', 'momo']);
  });
});
