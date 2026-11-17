import { afterEach, describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { toCounterSaleLine } from '../offline/sale';
import { cartTotal } from '../offline/cart';
import { repriced } from './HeldSales';
import { bandFor, newLine, unitChoices } from './catalogue';
import type { OfflinePack } from '../offline/types';

type OfflineProduct = components['schemas']['OfflineProduct'];

const band = (list: number) => ({
  listPricePesewas: list,
  floorPricePesewas: list - 500 > 0 ? list - 500 : 0,
  ceilingPricePesewas: list + 500,
  basis: 'PER_UNIT' as const,
});

/** CR-038's `OfflineProduct.sellingUnits`: a crate and a single egg, each with its own band. */
const SELLING = [
  { uom: 'CRATE', priceListEntryId: 'crate-entry', priceBand: band(6000), quoteOnly: false },
  { uom: 'UNIT', priceListEntryId: 'egg-entry', priceBand: band(220), quoteOnly: false },
];

/** The big eggs as CR-038 asks the pack to carry them. */
const EGGS = {
  product: { id: 'eggs', sku: 'EGG-0003', name: 'Eggs, big' },
  saleUom: 'CRATE',
  taxCategoryId: 't',
  priceBasis: 'PER_UNIT',
  priceBand: band(6000),
  priceListEntryId: 'crate-entry',
  quoteOnly: false,
  taxInclusive: true,
  tileCategory: 'Eggs',
  sellingUnits: SELLING,
} as unknown as OfflineProduct;

const PACK = { products: [EGGS], stockUnits: [] } as unknown as OfflinePack;

afterEach(() => {
  delete process.env.HK_REQUESTED_CONTRACT;
});

describe('a crate and a single egg at the till (CR-038, requested)', () => {
  it('offers no choice with the switch off, and sells in saleUom at the product band as before', () => {
    expect(unitChoices(EGGS)).toEqual([]);
    const line = newLine(EGGS, null);
    expect(line?.saleUom).toBe('CRATE');
    expect(line?.listUnitPricePesewas).toBe(6000);
    expect(line === null ? null : toCounterSaleLine(line)).not.toHaveProperty('uom');
  });

  it('prices a single egg from its own band, never the crate price divided, and sends its unit', () => {
    process.env.HK_REQUESTED_CONTRACT = 'CR-038';
    const [crate, egg] = unitChoices(EGGS);
    expect(crate?.uom).toBe('CRATE');
    expect(egg?.uom).toBe('UNIT');
    const eggs = egg === undefined ? null : newLine(EGGS, null, egg);
    expect(eggs).toMatchObject({ saleUom: 'UNIT', soldInUom: 'UNIT', listUnitPricePesewas: 220 });
    if (eggs === null) throw new Error('no line');
    const six = { ...eggs, quantity: '6.000' };
    // The one total the till works out: six eggs at the egg's own price (BUILD_PROMPT's exception).
    expect(cartTotal([six])).toBe(1320);
    expect(toCounterSaleLine(six)).toEqual({
      productId: 'eggs',
      quantity: '6.000',
      agreedUnitPricePesewas: 220,
      uom: 'UNIT',
    });
  });

  it('re-prices a held line in its own unit, and drops it when the pack no longer prices that unit', () => {
    process.env.HK_REQUESTED_CONTRACT = 'CR-038';
    const egg = unitChoices(EGGS)[1];
    const line = egg === undefined ? null : newLine(EGGS, null, egg);
    if (line === null) throw new Error('no line');
    expect(repriced([line], PACK)[0]?.listUnitPricePesewas).toBe(220);
    const noEggs = { ...EGGS, sellingUnits: [SELLING[0]] } as unknown as OfflineProduct;
    expect(bandFor(noEggs, 'UNIT')).toBeNull();
  });
});
