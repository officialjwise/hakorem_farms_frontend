/**
 * Finding what to sell in the offline pack (OFFLINE_SYNC.md 5.1): by barcode, by an animal's or a lot's
 * identifier, by name, or by tile. Everything here reads the pack the till downloaded; nothing calls the
 * API, so it works with the network off.
 */
import type { components } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import type { CartLine } from '../offline/cart';
import { pendingCount } from '../offline/sync';
import type { OfflinePack, TillSnapshot } from '../offline/types';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

export type ScanMatch =
  | { kind: 'unit'; product: OfflineProduct; unit: OfflineStockUnit }
  /** An animal or lot the pack says is not sellable here (sold, on hold, or at another location). */
  | { kind: 'unsellable'; product: OfflineProduct | null; unit: OfflineStockUnit }
  | { kind: 'product'; product: OfflineProduct }
  /** The same barcode on more than one product: the cashier chooses. */
  | { kind: 'several'; products: OfflineProduct[] }
  | { kind: 'quote-only'; product: OfflineProduct }
  | { kind: 'none'; code: string };

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

export function matchScan(pack: OfflinePack, code: string): ScanMatch {
  const wanted = normal(code);
  const unit = pack.stockUnits.find((entry) => normal(entry.identifier) === wanted);
  if (unit !== undefined) {
    const product = productById(pack, unit.productId);
    if (!unit.sellable || product === null) return { kind: 'unsellable', product, unit };
    return { kind: 'unit', product, unit };
  }
  const products = pack.products.filter(
    (entry) => entry.barcode !== null && normal(entry.barcode) === wanted,
  );
  if (products.length > 1) return { kind: 'several', products };
  const [product] = products;
  if (product === undefined) return { kind: 'none', code: code.trim() };
  if (product.quoteOnly) return { kind: 'quote-only', product };
  return { kind: 'product', product };
}

export function searchProducts(pack: OfflinePack, query: string): OfflineProduct[] {
  const words = normal(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return pack.products.filter((entry) => {
    const text = normal(`${entry.product.name} ${entry.product.sku} ${entry.barcode ?? ''}`);
    return words.every((word) => text.includes(word));
  });
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

/** A new line at the list price. A unit's last recorded weight is carried as an estimate. */
export function newLine(product: OfflineProduct, unit: OfflineStockUnit | null): CartLine | null {
  const band = product.priceBand;
  if (band === null) return null;
  return {
    key: newRecordId(),
    productId: product.product.id,
    productName: product.product.name,
    saleUom: product.saleUom,
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
