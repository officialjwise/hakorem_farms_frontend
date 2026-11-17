/**
 * CR-038, a product sold at the till in more than one unit, as `docs/CONTRACT_REQUESTS.md` asks for it
 * (ADR 0046, ADR 0049): a crate and a single egg, each with its own price band in the pack. Not in the
 * contract yet: these are the request's fields, read from the pack and written on a sale line only in a
 * build switched on for CR-038, and this file goes when the contract carries them.
 */
import type { components } from '@hakorem/api-client';
import { requestedOn } from './switch';

type Schemas = components['schemas'];
type OfflineProduct = Schemas['OfflineProduct'];
type CounterSaleLine = Schemas['CounterSaleLine'];
type PriceBand = Schemas['PriceBand'];

/** `OfflineProduct.sellingUnits[]`: one unit the product is sold by at this register, with its own band. */
export interface SellingUnit {
  uom: string;
  priceListEntryId: string | null;
  priceBand: PriceBand | null;
  quoteOnly: boolean;
}

interface PackFields {
  sellingUnits?: unknown;
}

/** `CounterSaleLine.uom`: the unit the line is sold in; absent means the product's `saleUom`. */
export type RequestedCounterSaleLine = CounterSaleLine & { uom?: string };

const isPesewas = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function asBand(value: unknown): PriceBand | null {
  if (value === null || typeof value !== 'object') return null;
  const band = value as Record<string, unknown>;
  if (
    !isPesewas(band.listPricePesewas) ||
    !isPesewas(band.floorPricePesewas) ||
    !isPesewas(band.ceilingPricePesewas) ||
    (band.basis !== 'PER_HEAD' && band.basis !== 'PER_KG' && band.basis !== 'PER_UNIT')
  ) {
    return null;
  }
  return {
    listPricePesewas: band.listPricePesewas,
    floorPricePesewas: band.floorPricePesewas,
    ceilingPricePesewas: band.ceilingPricePesewas,
    basis: band.basis,
  };
}

/**
 * The units this product is sold by, each with the band the pack gives it, when there is more than one.
 * Empty where the build is not switched on, the pack says nothing, or the product has one unit: the till
 * then sells it in `saleUom` at `priceBand`, as before. A unit's price is the pack's own, never one worked
 * out from another unit's.
 */
export function sellingUnits(product: OfflineProduct): SellingUnit[] {
  if (!requestedOn('CR-038')) return [];
  const raw = (product as OfflineProduct & PackFields).sellingUnits;
  if (!Array.isArray(raw)) return [];
  const units = raw.flatMap((entry: unknown): SellingUnit[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const unit = entry as Record<string, unknown>;
    if (typeof unit.uom !== 'string' || !/^[A-Z]{2,10}$/.test(unit.uom)) return [];
    return [
      {
        uom: unit.uom,
        priceListEntryId: typeof unit.priceListEntryId === 'string' ? unit.priceListEntryId : null,
        priceBand: asBand(unit.priceBand),
        quoteOnly: unit.quoteOnly === true,
      },
    ];
  });
  return units.length > 1 ? units : [];
}

/** A sale line with the unit it was sold in, in a build switched on for CR-038; unchanged otherwise. */
export function withSoldUnit(
  line: CounterSaleLine,
  uom: string | null | undefined,
): RequestedCounterSaleLine {
  if (!requestedOn('CR-038') || uom === null || uom === undefined) return line;
  return { ...line, uom };
}
