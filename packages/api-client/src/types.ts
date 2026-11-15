import type { operations as OperationShapes } from './generated/schema';
import type { operationManifest } from './generated/operations';

/** Every operation id in the contract. Query keys and mutation names derive from these. */
export type OperationId = keyof typeof operationManifest & keyof OperationShapes;

type Manifest = typeof operationManifest;
type Row<Op extends OperationId> = Manifest[Op];

/** True for an operation the contract says is a read (GET). Everything else is a mutation. */
export type IsQuery<Op extends OperationId> = Row<Op>['method'] extends 'get' ? true : false;

/** Operations that read: the ones `useApiQuery` takes. */
export type QueryOperationId = {
  [Op in OperationId]: Row<Op>['method'] extends 'get' ? Op : never;
}[OperationId];

/** Operations that write: the ones `useApiMutation` takes. */
export type MutationOperationId = Exclude<OperationId, QueryOperationId>;

type ParametersOf<Op extends OperationId> = OperationShapes[Op]['parameters'];
type PathOf<Op extends OperationId> = NonNullable<ParametersOf<Op>['path']>;
type QueryOf<Op extends OperationId> = NonNullable<ParametersOf<Op>['query']>;

/** `{ path }` when the operation has path parameters, else nothing. */
type PathInput<Op extends OperationId> = [PathOf<Op>] extends [never]
  ? unknown
  : { path: PathOf<Op> };

/** `{ query }`, optional when every query parameter is optional, absent when there are none. */
type QueryInput<Op extends OperationId> = [QueryOf<Op>] extends [never]
  ? unknown
  : Record<never, never> extends QueryOf<Op>
    ? { query?: QueryOf<Op> }
    : { query: QueryOf<Op> };

type ContentOf<Op extends OperationId> =
  NonNullable<OperationShapes[Op]['requestBody']> extends { content: infer Content }
    ? Content
    : never;

/**
 * The body a caller passes: the JSON body, or for a `multipart/form-data` operation (`uploadFile`) its
 * fields as an object, a file as a `Blob` (ADR 0037). `call()` turns that object into `FormData`.
 */
type BodyOf<Op extends OperationId> =
  ContentOf<Op> extends { 'application/json': infer Body }
    ? Body
    : ContentOf<Op> extends { 'multipart/form-data': infer Body }
      ? Body
      : never;

/** `{ body }`, required when the contract requires a body, absent when there is none. */
type BodyInput<Op extends OperationId> = [BodyOf<Op>] extends [never]
  ? unknown
  : undefined extends OperationShapes[Op]['requestBody']
    ? { body?: BodyOf<Op> }
    : { body: BodyOf<Op> };

/**
 * What a caller passes for an operation: its path and query parameters and its body, exactly as the
 * contract types them. The headers the contract requires (`Idempotency-Key`, `X-CSRF-Token`) are not part
 * of it: the client adds them, so a screen cannot forget one.
 */
export type OperationInput<Op extends OperationId> = PathInput<Op> & QueryInput<Op> & BodyInput<Op>;

/** True when the call needs no input at all, so `call('getCurrentSession')` is allowed. */
export type InputIsOptional<Op extends OperationId> =
  Record<never, never> extends OperationInput<Op> ? true : false;

type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206;
type Responses<Op extends OperationId> = OperationShapes[Op]['responses'];

type JsonOf<Response> = Response extends { content: { 'application/json': infer Body } }
  ? Body
  : undefined;

/**
 * The data a successful call resolves with: the JSON body of every 2xx response the contract lists (a
 * 202 `ApprovalPending` is part of the union, so a caller must handle it), or `undefined` for a 204.
 */
export type OperationData<Op extends OperationId> = {
  [Status in keyof Responses<Op> & SuccessStatus]: JsonOf<Responses<Op>[Status]>;
}[keyof Responses<Op> & SuccessStatus];

/** Whether the contract requires an `Idempotency-Key` on this operation. */
export type RequiresIdempotencyKey<Op extends OperationId> = Row<Op>['idempotent'];
