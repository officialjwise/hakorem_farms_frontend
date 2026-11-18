import { describe, expect, it } from 'vitest';
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

/** `OfflineProduct.sellingUnits` (CR-038, 2.11.0): a crate and a single egg, each with its own band. */
const SELLING = [
  { uom: 'CRATE', priceListEntryId: 'crate-entry', priceBand: band(6000), quoteOnly: false },
  { uom: 'EGG', priceListEntryId: 'egg-entry', priceBand: band(220), quoteOnly: false },
];

/** The big eggs as the pack carries them. */
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

describe('a crate and a single egg at the till (CR-038)', () => {
  it('offers no choice for a product sold in one unit, and sells in saleUom at the product band', () => {
    const crates = { ...EGGS, sellingUnits: [SELLING[0]] } as unknown as OfflineProduct;
    expect(unitChoices(crates)).toEqual([]);
    const line = newLine(crates, null);
    expect(line?.saleUom).toBe('CRATE');
    expect(line?.listUnitPricePesewas).toBe(6000);
    expect(line === null ? null : toCounterSaleLine(line)).not.toHaveProperty('uom');
  });

  it('prices a single egg from its own band, never the crate price divided, and sends its unit', () => {
    const [crate, egg] = unitChoices(EGGS);
    expect(crate?.uom).toBe('CRATE');
    expect(egg?.uom).toBe('EGG');
    const eggs = egg === undefined ? null : newLine(EGGS, null, egg);
    expect(eggs).toMatchObject({ saleUom: 'EGG', soldInUom: 'EGG', listUnitPricePesewas: 220 });
    if (eggs === null) throw new Error('no line');
    const six = { ...eggs, quantity: '6.000' };
    // The one total the till works out: six eggs at the egg's own price (BUILD_PROMPT's exception).
    expect(cartTotal([six])).toBe(1320);
    expect(toCounterSaleLine(six)).toEqual({
      productId: 'eggs',
      quantity: '6.000',
      agreedUnitPricePesewas: 220,
      uom: 'EGG',
    });
  });

  it('re-prices a held line in its own unit, and drops it when the pack no longer prices that unit', () => {
    const egg = unitChoices(EGGS)[1];
    const line = egg === undefined ? null : newLine(EGGS, null, egg);
    if (line === null) throw new Error('no line');
    expect(repriced([line], PACK)[0]?.listUnitPricePesewas).toBe(220);
    const noEggs = { ...EGGS, sellingUnits: [SELLING[0]] } as unknown as OfflineProduct;
    expect(bandFor(noEggs, 'EGG')).toBeNull();
  });
});
