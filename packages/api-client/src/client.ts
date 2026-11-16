import createClient from 'openapi-fetch';
import { operationManifest } from './generated/operations';
import { ApiError, CLIENT_ERROR_CODES, NetworkError, normaliseError } from './errors';
import { createSessionRefresher, type SessionHooks } from './singleFlight';
import type {
  InputIsOptional,
  OperationData,
  OperationId,
  OperationInput,
  RequiresIdempotencyKey,
} from './types';

/** How long a request may take before it is abandoned. A stalled request on a weak connection must not hang a screen. */
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ApiClientOptions {
  /** From `apiBaseUrl()`. The one place that decides mock or real is `baseUrl.ts`. */
  baseUrl: string;
  /** The session owner, so a 401 refreshes once and retries (ADR 0021). Omit for a client that has no session (public pages, tests). */
  session?: SessionHooks;
  /** For tests. Defaults to the global `fetch`. */
  fetch?: (request: Request) => Promise<Response>;
  timeoutMs?: number;
  /** Sent on every request. Tests use it to present a cookie to Prism, which checks the security scheme. */
  headers?: Record<string, string>;
}

export interface CallOptions {
  /** Cancels the request. Query hooks pass TanStack's signal. */
  signal?: AbortSignal;
}

/** Options for an operation: an idempotency key is required exactly when the contract requires one. */
export type CallOptionsFor<Op extends OperationId> =
  RequiresIdempotencyKey<Op> extends true
    ? CallOptions & {
        /** One per user intent, reused on every retry of it. Create it with `newIdempotencyKey()`. */
        idempotencyKey: string;
      }
    : CallOptions & { idempotencyKey?: never };

type CallArguments<Op extends OperationId> =
  RequiresIdempotencyKey<Op> extends true
    ? [input: OperationInput<Op>, options: CallOptionsFor<Op>]
    : InputIsOptional<Op> extends true
      ? [input?: OperationInput<Op>, options?: CallOptionsFor<Op>]
      : [input: OperationInput<Op>, options?: CallOptionsFor<Op>];

export interface ApiClient {
  readonly baseUrl: string;
  /**
   * Calls one operation of the contract by its operation id. Resolves with the success body, throws an
   * `ApiError` for anything else (a 4xx or 5xx envelope, or a `NetworkError`). It adds the
   * `Idempotency-Key` and `X-CSRF-Token` headers the contract asks for, and refreshes the session once
   * on a 401. It is the only thing in the codebase that calls `fetch` for the API.
   */
  call<Op extends OperationId>(
    operation: Op,
    ...args: CallArguments<Op>
  ): Promise<OperationData<Op>>;
  /**
   * Calls an operation the frontend has asked the backend for and the contract does not list yet
   * (`docs/CONTRACT_REQUESTS.md`, ADR 0046), through the same transport as `call`. The caller describes it
   * with a row shaped like the generated manifest's and owns its types, which are the request's, never a
   * guess. Only the console's `requested/` module calls it, and only in a build that switches the request
   * on; it is deleted once the contract carries the operation.
   */
  callRequested(
    operation: RequestedOperation,
    input?: { path?: Record<string, string>; query?: Record<string, unknown>; body?: unknown },
    options?: CallOptions & { idempotencyKey?: string },
  ): Promise<unknown>;
}

/** One row of the generated manifest: how an operation is sent. */
export type OperationRow = (typeof operationManifest)[OperationId];

/** An operation a contract request asks for, described as the manifest would describe it. */
export interface RequestedOperation {
  /** The request in `docs/CONTRACT_REQUESTS.md` that asks for it, for example `CR-032`. */
  request: string;
  operationId: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  permission: string | null;
  idempotent: boolean;
  csrf: 'none' | 'required';
  public: boolean;
  body: 'none' | 'json';
  device: boolean;
}

/** The slice of openapi-fetch this file uses, typed loosely on purpose: the public types above carry the contract. */
interface RawRequestInit {
  params: { path?: unknown; query?: unknown };
  body?: unknown;
  headers: Record<string, string>;
  signal: AbortSignal;
  fetch: (request: Request) => Promise<Response>;
}
interface RawClient {
  request(
    method: string,
    path: string,
    init: RawRequestInit,
  ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
}

type SendInput = { path?: unknown; query?: unknown; body?: unknown };

const CSRF_HEADER = 'X-CSRF-Token';
/** The enrolled till's credential (contract `deviceCredential`, ADR 0044). Sent only where the contract asks. */
const DEVICE_HEADER = 'X-Device-Credential';

/**
 * A multipart body (ADR 0037): each field of the object as a form field, a `Blob` as a file part with its
 * name when it has one (a `File`), anything else as text. The browser writes the boundary and the
 * Content-Type, and openapi-fetch passes `FormData` through untouched.
 */
function toFormData(body: unknown): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries((body ?? {}) as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Blob) {
      form.append(name, value, value instanceof File ? value.name : name);
    } else {
      form.append(name, String(value));
    }
  }
  return form;
}

/**
 * Rejects when `signal` aborts. Node's Request holds only a weak reference to the controller it makes
 * from `signal`, so an abort can fail to reach the request; racing against the signal itself makes a
 * timeout or a cancellation reliable on the server and in tests as well as in the browser.
 */
function whenAborted(signal: AbortSignal): Promise<never> {
  const promise = new Promise<never>((_resolve, reject) => {
    const rejectAborted = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) rejectAborted();
    else signal.addEventListener('abort', rejectAborted, { once: true });
  });
  promise.catch(() => undefined);
  return promise;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, session, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const baseFetch = options.fetch ?? ((request: Request) => globalThis.fetch(request));
  // openapi-fetch does the path, query and body serialisation. Its generic types are keyed by path and
  // method, which the operation-id types in types.ts replace, so the instance is used through RawClient.
  const raw = createClient({
    baseUrl,
    credentials: 'include',
    headers: options.headers,
  }) as unknown as RawClient;
  const refresher = session ? createSessionRefresher(session) : undefined;

  /** The fetch for one request: waits out a refresh already running, and refreshes once on a 401. */
  function transport(isPublic: boolean) {
    return async (request: Request): Promise<Response> => {
      if (session === undefined || refresher === undefined || isPublic) return baseFetch(request);

      const running = refresher.inFlight();
      if (running !== null) await running;

      const retryCopy = request.clone();
      const sentAt = refresher.generation();
      const response = await baseFetch(request);
      if (response.status !== 401) return response;

      // Refused with the cookie it was sent with. If a refresh finished while it was in flight, that
      // cookie is already replaced: retry with the result, do not refresh again (a second refresh in a
      // row would be read as token reuse and revoke the session).
      const outcome =
        refresher.generation() !== sentAt && refresher.inFlight() === null
          ? refresher.lastOutcome()
          : await refresher.refresh();
      if (outcome === 'unreachable') throw new NetworkError();
      if (outcome === 'expired') return response;

      // The refresh rotated the session, and with it the CSRF token.
      const headers = new Headers(retryCopy.headers);
      const csrf = session.getCsrfToken();
      if (headers.has(CSRF_HEADER) && csrf !== null) headers.set(CSRF_HEADER, csrf);
      const second = await baseFetch(new Request(retryCopy, { headers }));
      if (second.status === 401) session.onExpired();
      return second;
    };
  }

  async function call<Op extends OperationId>(
    operation: Op,
    ...args: CallArguments<Op>
  ): Promise<OperationData<Op>> {
    return send(
      operation,
      operationManifest[operation],
      (args[0] ?? {}) as SendInput,
      (args[1] ?? {}) as CallOptions & { idempotencyKey?: string },
    ) as Promise<OperationData<Op>>;
  }

  function callRequested(
    operation: RequestedOperation,
    input: SendInput = {},
    options: CallOptions & { idempotencyKey?: string } = {},
  ): Promise<unknown> {
    if (operation.operationId in operationManifest) {
      throw new Error(
        `${operation.operationId} (${operation.request}) is in the contract now: call it with call() and delete the request.`,
      );
    }
    return send(operation.operationId, operation, input, options);
  }

  async function send(
    operation: string,
    row: {
      method: string;
      path: string;
      idempotent: boolean;
      csrf: string;
      public: boolean;
      device: boolean;
      body: string;
    },
    input: SendInput,
    callOptions: CallOptions & { idempotencyKey?: string },
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (row.idempotent) {
      if (callOptions.idempotencyKey === undefined || callOptions.idempotencyKey === '') {
        throw new Error(
          `${operation} needs an idempotency key. Create one with newIdempotencyKey().`,
        );
      }
      headers['Idempotency-Key'] = callOptions.idempotencyKey;
    }
    const csrf = session?.getCsrfToken() ?? null;
    if (row.csrf !== 'none' && csrf !== null) headers[CSRF_HEADER] = csrf;
    const device = row.device ? (session?.getDeviceCredential?.() ?? null) : null;
    if (device !== null) headers[DEVICE_HEADER] = device;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort(callOptions.signal?.reason);
    if (callOptions.signal?.aborted) controller.abort(callOptions.signal.reason);
    callOptions.signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const result = await Promise.race([
        raw.request(row.method, row.path, {
          params: { path: input.path, query: input.query },
          body: row.body === 'multipart' ? toFormData(input.body) : input.body,
          headers,
          signal: controller.signal,
          fetch: transport(row.public),
        }),
        whenAborted(controller.signal),
      ]);
      if (!result.response.ok) throw normaliseError(result.response, result.error);
      return result.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut) throw new NetworkError(CLIENT_ERROR_CODES.TIMEOUT);
      if (callOptions.signal?.aborted) throw error;
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
      callOptions.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  return { baseUrl, call, callRequested };
}
