import { useCallback, useRef } from 'react';
import { newIdempotencyKey } from '@hakorem/api-client';
import type { FailureLike, QueryLike } from '@hakorem/ui';

/**
 * Two reads a screen needs together, seen by `QueryBoundary` as one: pending until both answer, the first
 * failure if either fails (a 403 on either is permission denied), and both answers once they are in.
 * Retrying refetches both.
 */
export function bothQueries<A, B, E extends FailureLike>(
  a: QueryLike<A, E>,
  b: QueryLike<B, E>,
): QueryLike<[A, B], E> {
  const refetch = () => {
    void a.refetch();
    void b.refetch();
  };
  if (a.status === 'error') return { status: 'error', data: undefined, error: a.error, refetch };
  if (b.status === 'error') return { status: 'error', data: undefined, error: b.error, refetch };
  if (a.data !== undefined && b.data !== undefined) {
    return { status: 'success', data: [a.data, b.data], error: null, refetch };
  }
  return { status: 'pending', data: undefined, error: null, refetch };
}

/**
 * One idempotency key per user intent (DATA_CONVENTIONS, "Mutations and idempotency"). The same request
 * body gets the same key, so "Try again" and a step-up repeat are the same intent and cannot double-post. A
 * changed body is a new intent with a new key, because the server answers the same key with a different
 * body with 409.
 */
export function useIntentKey(): (body: unknown) => string {
  const last = useRef<{ body: string; key: string } | null>(null);
  return useCallback((body: unknown) => {
    const text = JSON.stringify(body ?? null);
    if (last.current?.body !== text) last.current = { body: text, key: newIdempotencyKey() };
    return last.current.key;
  }, []);
}

/**
 * The rows of a list with each id once, first one kept. Options built from a list need unique values; the
 * contract's own `listBranches` example repeats its three branches, so the mock answers with each twice.
 */
export function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}
