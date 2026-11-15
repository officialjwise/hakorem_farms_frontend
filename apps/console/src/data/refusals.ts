import { ApiError, NetworkError, type ApiErrorDetail } from '@hakorem/api-client';

/**
 * Refusals in words (ADR 0038). The contract names every code an operation can refuse with
 * (`x-error-codes`), and a business-rule refusal names the broken rule in `details[].code`. The console
 * says each in its own words, from `common:refusals`:
 *
 * - the code's words replace the server's sentence: `refusals.codes.<CODE>`;
 * - each detail that names no field and whose rule has words adds them, after the code's words:
 *   `refusals.rules.<CODE>`. A detail that names a field keeps the server's sentence, which lands on that
 *   field (`mapServerErrors`);
 * - a code the build does not know keeps the server's sentence, which the contract says is safe to show.
 *   A rule the build does not know adds the server's sentence for that detail.
 *
 * It is applied once, where the console's API client throws (`data/api.ts`), so every screen, every
 * `MutationFailure` and every `FormError` shows the same words. The code, the reference and the details
 * are kept, so a screen can still branch on the code (STEP_UP_REQUIRED, a 409).
 */
export type RefusalWords = (key: string) => string | null;

let words: RefusalWords | null = null;

/** Called by `DataProvider` with the catalogue; returns a detach for its effect. */
export function attachRefusalWords(next: RefusalWords): () => void {
  words = next;
  return () => {
    if (words === next) words = null;
  };
}

function ruleWords(detail: ApiErrorDetail, say: RefusalWords): string | null {
  if (detail.field !== null) return null;
  return (
    say(`refusals.rules.${detail.code}`) ?? (detail.message.trim() === '' ? null : detail.message)
  );
}

/** The same refusal, said in the console's words where it has them. */
export function inWords(error: ApiError, say: RefusalWords | null = words): ApiError {
  if (say === null || error instanceof NetworkError || error.status === 0) return error;
  const codeWords = say(`refusals.codes.${error.code}`);
  const rules = error.details
    .map((detail) => (codeWords === null && detail.field === null ? null : ruleWords(detail, say)))
    .filter((line): line is string => line !== null);
  if (codeWords === null && rules.length === 0) return error;
  const message = [codeWords ?? error.message, ...rules].join(' ');
  return new ApiError({
    status: error.status,
    code: error.code,
    message,
    correlationId: error.correlationId,
    details: error.details,
    ...(error.retryAfter === undefined ? {} : { retryAfter: error.retryAfter }),
  });
}
