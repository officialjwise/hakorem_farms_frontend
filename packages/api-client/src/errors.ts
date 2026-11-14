import type { components } from './generated/schema';

/** The contract's single error envelope: `{ error: { code, message, correlationId, details[] } }`. */
export type ApiErrorEnvelope = components['schemas']['Error'];
/** One entry of the envelope's `details`. `field` is a JSON pointer, or null for the whole request. */
export type ApiErrorDetail = components['schemas']['ErrorDetail'];

/** Codes the client invents when no envelope came back. A screen maps each to its own words. */
export const CLIENT_ERROR_CODES = {
  /** The request never reached the server, or the connection dropped. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** The request took longer than the client waits. */
  TIMEOUT: 'TIMEOUT',
  /** The server answered with something that is not the error envelope (a proxy page, an empty 502). */
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export interface ApiErrorInit {
  /** The HTTP status, or 0 when there was no response. */
  status: number;
  code: string;
  message: string;
  /** Empty when the failure happened before any response, because there is nothing to quote. */
  correlationId: string;
  details?: readonly ApiErrorDetail[];
  /** Seconds, from `Retry-After`, on a 429. */
  retryAfter?: number;
}

/**
 * Every failed call, normalised once (ADR 0020). `envelope` is exactly the shape `packages/ui`'s
 * `mapServerErrors` and `isServerErrorEnvelope` take, so a form maps it onto its fields without a second
 * error type. `status` rides alongside because the envelope has none and a screen needs it (403 is
 * permission denied, 404 is not found).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;
  readonly details: readonly ApiErrorDetail[];
  readonly retryAfter: number | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.details = init.details ?? [];
    this.retryAfter = init.retryAfter;
  }

  /** The contract's error envelope, ready for `mapServerErrors`. */
  get envelope(): ApiErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        correlationId: this.correlationId,
        details: [...this.details],
      },
    };
  }
}

/** A request that got no answer: offline, DNS, refused, dropped or timed out. `status` is 0. */
export class NetworkError extends ApiError {
  constructor(code: 'NETWORK_ERROR' | 'TIMEOUT' = CLIENT_ERROR_CODES.NETWORK_ERROR) {
    super({
      status: 0,
      code,
      message:
        code === CLIENT_ERROR_CODES.TIMEOUT
          ? 'The server took too long to answer.'
          : 'The server could not be reached.',
      correlationId: '',
    });
    this.name = 'NetworkError';
  }
}

/** True when `value` has the envelope's shape. Mirrors `isServerErrorEnvelope` in packages/ui. */
export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === 'string' &&
    typeof e.message === 'string' &&
    typeof e.correlationId === 'string' &&
    Array.isArray(e.details)
  );
}

/** Builds the ApiError for a non-2xx response. `body` is the parsed JSON, or the raw text when it was not JSON. */
export function normaliseError(response: Response, body: unknown): ApiError {
  const retryAfterHeader = Number(response.headers.get('Retry-After'));
  const retryAfter =
    Number.isFinite(retryAfterHeader) && response.headers.has('Retry-After')
      ? retryAfterHeader
      : undefined;
  if (isApiErrorEnvelope(body)) {
    const { code, message, correlationId, details } = body.error;
    return new ApiError({
      status: response.status,
      code,
      message,
      correlationId,
      details,
      retryAfter,
    });
  }
  return new ApiError({
    status: response.status,
    code: CLIENT_ERROR_CODES.INVALID_RESPONSE,
    message: 'The server sent a reply this app does not understand.',
    correlationId: response.headers.get('X-Correlation-Id') ?? '',
    retryAfter,
  });
}
