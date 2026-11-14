import { ApiError, NetworkError } from '@hakorem/api-client';

/** Reads retry twice, then show the error. */
export const MAX_QUERY_RETRIES = 2;
/** A write retries at most twice, and only when the answer is "never got there" (ADR 0022). */
export const MAX_MUTATION_RETRIES = 2;

/** Statuses where trying again can help: the server or a proxy in front of it was busy, not wrong. */
const RETRYABLE_STATUSES: readonly number[] = [429, 502, 503, 504];

/** True for "no answer" (offline, timeout) and the busy statuses. Never a 4xx the user must act on, never a 500. */
export function isTransient(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && RETRYABLE_STATUSES.includes(error.status);
}

/** TanStack `retry` for queries: transient failures only. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isTransient(error);
}

/**
 * TanStack `retry` for mutations: only when nothing reached the server (`NetworkError`) or a proxy said
 * it was busy. The retry carries the same idempotency key and body, so it cannot double-post. A 500 is
 * not retried: the server may have done part of it, and a person should look.
 */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_MUTATION_RETRIES && isTransient(error);
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 8_000;

/** Exponential backoff (1 s, 2 s, 4 s, capped at 8 s), or the server's `Retry-After` when it sent one. */
export function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfter !== undefined) {
    return Math.min(error.retryAfter * 1_000, 30_000);
  }
  return Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_DELAY_MS);
}
