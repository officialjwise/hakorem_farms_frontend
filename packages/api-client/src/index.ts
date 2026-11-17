export { API_BASE_URL_VARIABLE, apiBaseUrl, parseApiBaseUrl } from './baseUrl';
export {
  createApiClient,
  DEFAULT_TIMEOUT_MS,
  type ApiClient,
  type ApiClientOptions,
  type CallOptions,
  type CallOptionsFor,
  type OperationRow,
  type RequestedOperation,
} from './client';
export {
  ApiError,
  CLIENT_ERROR_CODES,
  isApiErrorEnvelope,
  NetworkError,
  normaliseError,
  type ApiErrorDetail,
  type ApiErrorEnvelope,
  type ApiErrorInit,
} from './errors';
export { newIdempotencyKey } from './idempotency';
export { operationManifest, CONTRACT_VERSION } from './generated/operations';
export { seededRoles } from './generated/seededRoles';
export type { components, operations, paths } from './generated/schema';
export { createSessionRefresher, type RefreshOutcome, type SessionHooks } from './singleFlight';
export type {
  InputIsOptional,
  IsQuery,
  MutationOperationId,
  OperationData,
  OperationId,
  OperationInput,
  QueryOperationId,
  RequiresIdempotencyKey,
} from './types';
