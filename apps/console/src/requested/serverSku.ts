/**
 * CR-034, the server gives each product its SKU, as `docs/CONTRACT_REQUESTS.md` asks for it (owner,
 * 2026-11-17; ADR 0046). In contract 1.53.0 `ProductCreate.sku` is required, so the console would have to
 * type one. The owner decided a SKU is never typed: the server generates it and the product screens show it
 * once the product is saved. This file goes when the contract carries the change.
 */
import type { components } from '@hakorem/api-client';
import { requestedOn } from './switch';

type ProductCreate = components['schemas']['ProductCreate'];

/** `ProductCreate` as CR-034 asks for it: no `sku`; the server generates it and answers it on the product. */
export type ProductCreateRequested = Omit<ProductCreate, 'sku'>;

/** Whether this build may create a product: only against a server that gives the SKU. */
export function serverGivesSku(): boolean {
  return requestedOn('CR-034');
}

/**
 * The body `createProduct` takes under CR-034. The generated type still requires `sku`; this is the one
 * place that sends it without one, and only in a build switched on for CR-034.
 */
export function productCreateBody(body: ProductCreateRequested): ProductCreate {
  return body as ProductCreate;
}
