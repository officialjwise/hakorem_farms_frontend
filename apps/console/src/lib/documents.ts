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
};

/**
 * The console path of a document the API names, or undefined when it is not one of the console's own
 * screens (a sale, an invoice), so a document becomes a link only where it leads somewhere.
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
