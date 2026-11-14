import { cache } from 'react';
import { createI18n, type Namespace } from '@hakorem/i18n';

/**
 * Server-side translation (ADR 0008, ADR 0015). Server components call `getT('storefront')` and pass the
 * resulting strings to client components as props, so no i18n runtime ships to the browser for a page that
 * only reads text. `cache` makes it one instance per namespace per request, never a shared global, so a
 * request cannot leak its language into another.
 */
export const getT = cache(async <N extends Namespace>(namespace: N) => {
  const i18n = await createI18n({ namespaces: [namespace] });
  return i18n.getFixedT(null, namespace);
});
