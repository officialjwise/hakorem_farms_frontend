/**
 * A client-generated idempotency key: a UUID created once per user intent and reused on every retry of
 * that intent, so a retry on a flaky connection cannot double-charge or double-post. The contract's
 * `Idempotency-Key` header is `required: true`, `format: uuid`, and the same key with a different body is
 * refused with 409.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
