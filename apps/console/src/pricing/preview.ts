import type { components } from '@hakorem/api-client';

export type PriceListEntry = components['schemas']['PriceListEntry'];
export type PriceListEntryInput = components['schemas']['PriceListEntryInput'];

/** What happens to one priced line when the draft activates. */
export type ChangeKind = 'added' | 'changed' | 'removed' | 'unchanged';

export interface PreviewRow {
  /** Product, grade, weight band and quantity break: the line's identity in the list. */
  key: string;
  kind: ChangeKind;
  /** The line as it is priced today, in the active version. Null for an added line. */
  now: PriceListEntry | null;
  /** The line as it will be priced from the draft's valid-from time. Null for a removed line. */
  next: PriceListEntry | null;
}

/**
 * The contract refuses two entries with the same product, grade, band and quantity break
 * (`replacePriceListEntries`), so those four name one line across versions.
 */
export function entryKey(entry: PriceListEntry): string {
  return [entry.product.id, entry.grade?.id ?? '', entry.weightBand?.id ?? '', entry.minQty].join(
    '|',
  );
}

/** Every field a person can change on a line. Compared, never computed with. */
function samePrice(a: PriceListEntry, b: PriceListEntry): boolean {
  return (
    a.basis === b.basis &&
    a.listPricePesewas === b.listPricePesewas &&
    a.floorPricePesewas === b.floorPricePesewas &&
    a.ceilingPricePesewas === b.ceilingPricePesewas &&
    a.quoteOnly === b.quoteOnly
  );
}

const ORDER: Record<ChangeKind, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };

/**
 * The preview of a draft before it activates (FR-MDM, the F4 gate): each line of the draft beside the same
 * line in the active version, marked added, changed, removed or unchanged. It only lines the two up and
 * compares them; every figure shown is one the API sent. Changes come first, then the rest in the draft's
 * order. With no active version every line is added.
 */
export function previewChanges(
  active: readonly PriceListEntry[],
  draft: readonly PriceListEntry[],
): PreviewRow[] {
  const current = new Map(active.map((entry) => [entryKey(entry), entry]));
  const rows: PreviewRow[] = draft.map((next) => {
    const key = entryKey(next);
    const now = current.get(key) ?? null;
    current.delete(key);
    const kind: ChangeKind =
      now === null ? 'added' : samePrice(now, next) ? 'unchanged' : 'changed';
    return { key, kind, now, next };
  });
  for (const [key, now] of current) rows.push({ key, kind: 'removed', now, next: null });
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => ORDER[a.row.kind] - ORDER[b.row.kind] || a.index - b.index)
    .map(({ row }) => row);
}

/** How many lines of each kind, for the summary above the preview. Counting rows, not money. */
export function countChanges(rows: readonly PreviewRow[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
}

/** An entry as the contract's input, so the whole draft can be sent back with one line changed. */
export function toInput(entry: PriceListEntry): PriceListEntryInput {
  return {
    productId: entry.product.id,
    ...(entry.grade === null ? {} : { gradeId: entry.grade.id }),
    ...(entry.weightBand === null ? {} : { weightBandId: entry.weightBand.id }),
    basis: entry.basis,
    listPricePesewas: entry.listPricePesewas,
    floorPricePesewas: entry.floorPricePesewas,
    ceilingPricePesewas: entry.ceilingPricePesewas,
    quoteOnly: entry.quoteOnly,
    minQty: entry.minQty,
  };
}
