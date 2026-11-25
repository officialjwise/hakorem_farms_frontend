import type { components } from '@hakorem/api-client';

type BillingDocument = components['schemas']['BillingDocument'];

/** Why the till does not offer to take cash for a document; the server judges it again whatever the till says. */
export type NotPayable = 'NOT_AN_INVOICE' | 'NOT_ISSUED' | 'SETTLED' | 'RECEIPT_NOT_OF_ORDER';

/**
 * What `payInvoiceAtTill` takes (2.26.0, 2.36.0): an issued invoice with something outstanding, or an issued
 * receipt of a sales order with something outstanding (a guest's collection balance). Anything else is
 * refused `NOT_AN_INVOICE`, `INVOICE_NOT_ISSUED` or `INVOICE_SETTLED`, so the till says so before asking.
 * Another branch's invoice is the server's to refuse (`INVOICE_OTHER_BRANCH`): the till does not guess it.
 */
export function payableAtTill(
  document: Pick<BillingDocument, 'kind' | 'status' | 'order' | 'settlement'>,
): NotPayable | null {
  if (document.kind !== 'INVOICE' && document.kind !== 'RECEIPT') return 'NOT_AN_INVOICE';
  if (document.status !== 'ISSUED') return 'NOT_ISSUED';
  if (document.kind === 'RECEIPT' && document.order === null) return 'RECEIPT_NOT_OF_ORDER';
  if (document.settlement.outstandingPesewas <= 0) return 'SETTLED';
  return null;
}
