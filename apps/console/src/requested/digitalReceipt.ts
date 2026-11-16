/**
 * CR-033, the digital receipt, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0045, ADR 0046). Not in the
 * contract yet: these are the request's fields, read from the pack and the sync result only in a build
 * switched on for CR-033, and this file goes when the contract carries them.
 */
import type { components } from '@hakorem/api-client';
import { requestedOn } from './switch';

type OfflinePack = components['schemas']['OfflinePack'];
type SyncResultItem = components['schemas']['SyncResultItem'];

/** `OfflinePack.receiptLinkTemplate`: the customer's receipt page, with `{saleId}` for the sale's client id. */
interface PackFields {
  receiptLinkTemplate?: unknown;
}

/** `SyncResultItem.receiptMessage`: whether the server sent the receipt by SMS for this sale. */
export type ReceiptMessageStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'NO_PHONE';
interface ResultFields {
  receiptMessage?: { channel?: unknown; status?: unknown } | null;
}

const STATUSES: readonly ReceiptMessageStatus[] = ['QUEUED', 'SENT', 'FAILED', 'NO_PHONE'];
const SALE_ID = '{saleId}';

/**
 * The link the customer opens for this sale's receipt, made on the till with no network: the pack's
 * template with the sale's client id in it. Null where the build or the pack has none.
 */
export function receiptLink(pack: OfflinePack | null, saleId: string): string | null {
  if (!requestedOn('CR-033') || pack === null) return null;
  const template = (pack as OfflinePack & PackFields).receiptLinkTemplate;
  if (typeof template !== 'string' || !template.includes(SALE_ID)) return null;
  const link = template.replace(SALE_ID, encodeURIComponent(saleId));
  try {
    const url = new URL(link);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** What the server said about the SMS, once the sale has synced. Null before, or where it says nothing. */
export function receiptMessage(result: SyncResultItem | null): ReceiptMessageStatus | null {
  if (!requestedOn('CR-033') || result === null) return null;
  const status = (result as SyncResultItem & ResultFields).receiptMessage?.status;
  return STATUSES.find((value) => value === status) ?? null;
}
