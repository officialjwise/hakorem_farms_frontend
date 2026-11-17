import { matchRoutes } from 'react-router';
import { protectedRoutes } from '../app/routes';

/** Where each kind of document the API names (`DocumentRef.docType`) opens in the console, by its id. */
const DOCUMENT_PATH: Record<string, string> = {
  GOODS_RECEIPT: '/goods-receipts/',
  STOCK_TRANSFER: '/stock-transfers/',
  STOCK_ADJUSTMENT: '/stock-adjustments/',
  STOCK_TAKE: '/stock-takes/',
  HEALTH_EVENT: '/health-events/',
  MORTALITY_RECORD: '/mortality/',
  BREEDING_RECORD: '/breeding/',
  PROCESSING_ORDER: '/processing-orders/',
  PURCHASE_ORDER: '/purchase-orders/',
  SUPPLIER_INVOICE: '/supplier-invoices/',
  SUPPLIER_PAYMENT: '/supplier-payments/',
  SUPPLIER_CLAIM: '/supplier-claims/',
  // F10h: an order made from a quote, and the quote.
  SALES_ORDER: '/orders/',
  QUOTE: '/quotes/',
  // F8: a billing document's kind is its docType (`ArchivedDocument.businessDocument`).
  INVOICE: '/billing-documents/',
  RECEIPT: '/billing-documents/',
  PROFORMA: '/billing-documents/',
  CREDIT_NOTE: '/billing-documents/',
  DEBIT_NOTE: '/billing-documents/',
};

/**
 * The console path of a document the API names, or undefined when it is not one of the console's own
 * screens (a sale, an order), so a document becomes a link only where it leads somewhere.
 */
export function documentHref(document: { docType: string; id: string }): string | undefined {
  const base = DOCUMENT_PATH[document.docType];
  if (base === undefined) return undefined;
  const href = `${base}${document.id}`;
  const matched = (matchRoutes(protectedRoutes, href) ?? []).some(
    (match) => match.route.path !== undefined,
  );
  return matched ? href : undefined;
}
