/**
 * Compile-time tests: the contract's generated `Error` and `packages/ui`'s `ServerErrorEnvelope` are one
 * shape: the contract's envelope goes into the form system as is. (The UI type is `readonly`, which
 * is the looser side, so the reverse direction is not required.) If either side drifts, `pnpm typecheck` fails here (ADR 0020).
 */
import type { ApiError, ApiErrorEnvelope } from '@hakorem/api-client';
import type { ServerErrorEnvelope } from '@hakorem/ui';

declare const fromContract: ApiErrorEnvelope;
declare const apiError: ApiError;

export const toUi: ServerErrorEnvelope = fromContract;
// What a form takes is what the data layer produces, with nothing in between.
export const fromFailure: ServerErrorEnvelope = apiError.envelope;
