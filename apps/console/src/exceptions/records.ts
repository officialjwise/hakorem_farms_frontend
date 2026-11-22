/**
 * Where the record behind an exception opens in the back office, by the `DocumentRef.docType` the API names.
 * A type with no screen here yet (a payment, a till shift, a role grant) gets no link: the report names it
 * in words with its number instead, so nothing points at a page that does not exist.
 */
const ROUTES: Readonly<Record<string, (id: string) => string>> = {
  SALES_ORDER: (id) => `/orders/${id}`,
  RECEIPT: (id) => `/billing-documents/${id}`,
  INVOICE: (id) => `/billing-documents/${id}`,
  CREDIT_NOTE: (id) => `/billing-documents/${id}`,
  PURCHASE_ORDER: (id) => `/purchase-orders/${id}`,
  GOODS_RECEIPT: (id) => `/goods-receipts/${id}`,
  STOCK_ADJUSTMENT: (id) => `/stock-adjustments/${id}`,
  STOCK_TRANSFER: (id) => `/stock-transfers/${id}`,
  STOCK_TAKE: (id) => `/stock-takes/${id}`,
  QUOTE: (id) => `/quotes/${id}`,
  MORTALITY_RECORD: (id) => `/mortality/${id}`,
  PROCESSING_ORDER: (id) => `/processing-orders/${id}`,
  HEALTH_EVENT: (id) => `/health-events/${id}`,
  SUPPLIER_INVOICE: (id) => `/supplier-invoices/${id}`,
  SUPPLIER_PAYMENT: (id) => `/supplier-payments/${id}`,
  CUSTOMER_STATEMENT: (id) => `/statements/${id}`,
  PRICE_LIST_VERSION: (id) => `/price-list-versions/${id}`,
};

/** The back office path of a record, or null when it has no screen yet. */
export function recordPath(docType: string, id: string): string | null {
  const route = Object.prototype.hasOwnProperty.call(ROUTES, docType) ? ROUTES[docType] : undefined;
  return route === undefined ? null : route(encodeURIComponent(id));
}

const SEVERITY_RANK: Readonly<Record<string, number>> = { URGENT: 0, REVIEW: 1, INFO: 2 };

interface Sortable {
  severity: string;
  raisedAt: string;
}

/**
 * The report's order: urgent first, then review, then information (an unknown severity last); within one,
 * what nobody has reviewed before what someone has; then the newest first. Ordering only: no figure is
 * computed here.
 */
export function byUrgency<T extends Sortable>(
  items: readonly T[],
  reviewed: (item: T) => boolean,
): T[] {
  const rank = (item: T) => SEVERITY_RANK[item.severity] ?? 3;
  return [...items].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(reviewed(a)) - Number(reviewed(b)) ||
      (a.raisedAt < b.raisedAt ? 1 : a.raisedAt > b.raisedAt ? -1 : 0),
  );
}
