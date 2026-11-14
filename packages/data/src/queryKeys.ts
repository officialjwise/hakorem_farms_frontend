import {
  operationManifest,
  type OperationId,
  type OperationInput,
  type QueryOperationId,
} from '@hakorem/api-client';

/**
 * A query key is the contract's operation id, then the call's input: `['listProducts', { query: { q } }]`.
 * It is derived, never typed by hand, so two screens asking the same question share one cache entry and a
 * renamed operation is a type error. Invalidate every call of an operation with `[operationId]`.
 */
export type ApiQueryKey<Op extends QueryOperationId = QueryOperationId> = readonly [
  operation: Op,
  input?: OperationInput<Op>,
];

export function queryKey<Op extends QueryOperationId>(
  operation: Op,
  input?: OperationInput<Op>,
): ApiQueryKey<Op> {
  return input === undefined ? [operation] : [operation, input];
}

/** The first path segment: `/products/{id}/archive` is `products`. */
export function resourceRoot(path: string): string {
  return path.split('/')[1] ?? '';
}

/**
 * Whether a cached query is about the same resource as a mutated operation. After a write to
 * `/products/{id}/archive`, every cached read under `/products` is suspect (the list, the detail), and
 * is invalidated, so a screen never has to remember which reads a write affects. The rule is derived
 * from the contract's paths and errs on the side of refetching.
 */
export function isSameResource(mutation: OperationId, cachedKey: readonly unknown[]): boolean {
  const cached = cachedKey[0];
  if (typeof cached !== 'string' || !(cached in operationManifest)) return false;
  const root = resourceRoot(operationManifest[mutation].path);
  return root !== '' && resourceRoot(operationManifest[cached as OperationId].path) === root;
}
