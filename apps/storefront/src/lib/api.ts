import { cache } from 'react';
import {
  ApiError,
  apiBaseUrl,
  createApiClient,
  NetworkError,
  type ApiClient,
  type OperationData,
  type OperationInput,
  type QueryOperationId,
} from '@hakorem/api-client';

/**
 * The storefront's server-side reads (ADR 0015, ADR 0019). Server components read the public catalogue
 * through the generated client, never `fetch`, so a listing is one server round trip and no API code
 * reaches the browser for it. There is no session: every operation read here is anonymous.
 */
let client: ApiClient | undefined;
function serverApi(): ApiClient {
  client ??= createApiClient({ baseUrl: apiBaseUrl() });
  return client;
}

/** A read's outcome. A page renders its error state from `error`, with the reference, instead of throwing. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** One read. Any failure, including no answer at all, comes back as an `ApiError` with its reference. */
export async function load<Op extends QueryOperationId>(
  operation: Op,
  input?: OperationInput<Op>,
): Promise<Loaded<OperationData<Op>>> {
  try {
    // The generated client's argument list depends on the operation; a public read takes input alone.
    const call = serverApi().call as unknown as (
      op: Op,
      input?: OperationInput<Op>,
    ) => Promise<OperationData<Op>>;
    const data = (await call(operation, input)) as OperationData<Op>;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error : new NetworkError() };
  }
}

/** The shop's categories, once per request: the header, the footer and a category page share this read. */
export const getShopCategories = cache(() => load('listShopCategories', { query: { limit: 100 } }));

/** A product by its slug, once per request: the metadata and the page share this read. */
export const getShopProduct = cache((slug: string) =>
  load('getCatalogueProduct', { path: { slug } }),
);

/**
 * The shop's phone, WhatsApp and address (CR-028), once per request. The API answers it cacheable for five
 * minutes; a 404 means no business profile is set, and the page then shows no number.
 */
export const getShopProfile = cache(() => load('getShopProfile'));
