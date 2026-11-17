/**
 * Finding what to sell in the offline pack (OFFLINE_SYNC.md 5.1): by tapping a tile, or by searching for a
 * name, a SKU, or an animal's or a lot's tag. No barcode scanning at the till (owner, 2026-11-17, ADR 0048). Everything here reads the pack the till downloaded; nothing calls the
 * API, so it works with the network off.
 */
import type { components } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import { sellingUnits, type SellingUnit } from '../../requested/sellingUnits';
import type { CartLine } from '../offline/cart';
import { pendingCount } from '../offline/sync';
import type { OfflinePack, TillSnapshot } from '../offline/types';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

/** What the search box found: animals and lots by their tag, and products by name or SKU. */
export interface FindResults {
  /** Sellable animals and lots whose tag contains the search, not already on the sale. */
  units: { product: OfflineProduct; unit: OfflineStockUnit }[];
  /** Animals and lots the pack has with that exact tag but not for sale here (sold, on hold, elsewhere). */
  unsellable: OfflineStockUnit[];
  products: OfflineProduct[];
}

const normal = (text: string) => text.trim().toUpperCase();

export function productById(pack: OfflinePack, id: string): OfflineProduct | null {
  return pack.products.find((entry) => entry.product.id === id) ?? null;
}

/** Products with sellable stock units are sold by the unit: a goat by its tag, never "a goat". */
export function isSoldByUnit(pack: OfflinePack, product: OfflineProduct): boolean {
  return pack.stockUnits.some((unit) => unit.productId === product.product.id);
}

export function sellableUnits(pack: OfflinePack, product: OfflineProduct): OfflineStockUnit[] {
  return pack.stockUnits.filter((unit) => unit.productId === product.product.id && unit.sellable);
}

export function findInPack(
  pack: OfflinePack,
  query: string,
  onSale: readonly string[] = [],
): FindResults {
  const wanted = normal(query);
  const words = wanted.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { units: [], unsellable: [], products: [] };
  const units: FindResults['units'] = [];
  const unsellable: OfflineStockUnit[] = [];
  for (const unit of pack.stockUnits) {
    const tag = normal(unit.identifier);
    const product = productById(pack, unit.productId);
    if (unit.sellable && product !== null && tag.includes(wanted)) {
      if (!onSale.includes(unit.id)) units.push({ product, unit });
    } else if (tag === wanted) {
      unsellable.push(unit);
    }
  }
  const products = pack.products.filter((entry) => {
    const text = normal(`${entry.product.name} ${entry.product.sku}`);
    return words.every((word) => text.includes(word));
  });
  return { units, unsellable, products };
}

/** The tiles, in the pack's order, grouped by their category. */
export function tiles(
  pack: OfflinePack,
): { category: string | null; products: OfflineProduct[] }[] {
  const groups = new Map<string | null, OfflineProduct[]>();
  for (const entry of pack.products) {
    const key = entry.tileCategory;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()].map(([category, products]) => ({ category, products }));
}

/**
 * The units a cashier chooses between for this product (CR-038, requested): a crate and a single egg, each
 * with the pack's own band. Empty when the product is sold in one unit.
 */
export function unitChoices(product: OfflineProduct): SellingUnit[] {
  return sellingUnits(product);
}

/**
 * The band a line is priced from: the chosen selling unit's own, or the product's. Null when the pack no
 * longer prices that unit. A single egg's price is never worked out from a crate's.
 */
export function bandFor(
  product: OfflineProduct,
  soldInUom: string | null | undefined,
): OfflineProduct['priceBand'] {
  if (soldInUom === null || soldInUom === undefined) return product.priceBand;
  return sellingUnits(product).find((unit) => unit.uom === soldInUom)?.priceBand ?? null;
}

/**
 * A new line at the list price, in the selling unit chosen or the product's own. A unit's last recorded
 * weight is carried as an estimate.
 */
export function newLine(
  product: OfflineProduct,
  unit: OfflineStockUnit | null,
  selling: SellingUnit | null = null,
): CartLine | null {
  const band = bandFor(product, selling?.uom);
  if (band === null) return null;
  return {
    key: newRecordId(),
    productId: product.product.id,
    productName: product.product.name,
    saleUom: selling?.uom ?? product.saleUom,
    soldInUom: selling?.uom ?? null,
    priceBasis: product.priceBasis,
    taxCategoryId: product.taxCategoryId,
    stockUnitId: unit?.id ?? null,
    stockUnitIdentifier: unit?.identifier ?? null,
    gradeId: unit?.gradeId ?? null,
    quantity: '1.000',
    weightKg: unit?.lastWeightKg ?? null,
    weightSource: unit?.lastWeightKg != null ? 'ESTIMATE' : null,
    listUnitPricePesewas: band.listPricePesewas,
    floorUnitPricePesewas: band.floorPricePesewas,
    ceilingUnitPricePesewas: band.ceilingPricePesewas,
    agreedUnitPricePesewas: band.listPricePesewas,
    varianceReasonCode: null,
  };
}

/** Why the till cannot take a new sale now, or null when it can (OFFLINE_SYNC 5.1). */
export type SellingBlock = 'NO_PACK' | 'PACK_EXPIRED' | 'OFFLINE_TOO_LONG' | 'QUEUE_FULL';

export function sellingBlock(snapshot: TillSnapshot, now: Date): SellingBlock | null {
  const { pack, meta } = snapshot;
  if (pack === null) return 'NO_PACK';
  if (now.toISOString() > pack.validUntil) return 'PACK_EXPIRED';
  const reached = meta.lastReachedServerAt ?? meta.packFetchedAt;
  if (reached !== null) {
    const limit = new Date(reached).getTime() + pack.policy.maxOfflineHours * 3_600_000;
    if (now.getTime() > limit) return 'OFFLINE_TOO_LONG';
  }
  const queuedSales = snapshot.entries.filter(
    (e) => e.kind === 'SALE' && ['QUEUED', 'SENDING'].includes(e.localStatus),
  );
  if (queuedSales.length >= pack.policy.maxQueuedSales) return 'QUEUE_FULL';
  return null;
}

/** The pack's methods the till may take now: offline, only those the policy lists (cash by default). */
export function tenderMethods(pack: OfflinePack, online: boolean) {
  return online
    ? pack.paymentMethods
    : pack.paymentMethods.filter((method) =>
        pack.policy.offlineTenderMethodIds.includes(method.id),
      );
}

export { pendingCount };
