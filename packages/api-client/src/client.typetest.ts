/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked @ts-expect-error stops being an error,
 * meaning the client got looser than the contract.
 */
import type { ApiClient } from './client';
import type { components } from './generated/schema';
import type { MutationOperationId, OperationData, QueryOperationId } from './types';

declare const client: ApiClient;
const key = '019a7b1d-1c55-7fe4-b51c-071c42887ffa';

export async function calls() {
  // A read: no input needed when every parameter is optional, and the body is the contract's page.
  const page = await client.call('listProducts');
  const first: string | undefined = page.data[0]?.id;
  await client.call('listProducts', { query: { q: 'goat', limit: 25 } });

  // A path parameter is required.
  await client.call('getProduct', { path: { id: 'p1' } });

  // A mutation needs its key and a body of the contract's shape.
  await client.call(
    'archiveProduct',
    { path: { id: 'p1' }, body: { version: 1, reason: 'Discontinued' } },
    { idempotencyKey: key },
  );

  // A call with no input at all, and a 204.
  const session = await client.call('getCurrentSession');
  const gone: undefined = await client.call('logout');

  // @ts-expect-error an operation id that is not in the contract
  await client.call('listProduct');

  // @ts-expect-error getProduct needs its path parameter
  await client.call('getProduct');

  // @ts-expect-error a query parameter the contract does not have
  await client.call('listProducts', { query: { colour: 'red' } });

  const archive = { path: { id: 'p1' } };
  const opts = { idempotencyKey: key };
  const noReason = { version: 1 };

  // @ts-expect-error the contract requires an Idempotency-Key on archiveProduct
  await client.call('archiveProduct', { ...archive, body: { version: 1, reason: 'x' } });

  // @ts-expect-error the body must carry the contract's required fields
  await client.call('archiveProduct', { ...archive, body: noReason }, opts);

  // @ts-expect-error a read takes no idempotency key
  await client.call('listProducts', {}, { idempotencyKey: key });

  return [first, session, gone];
}

// Money is an integer on the wire, weight is a three-place string. Never the other way round.
export const pesewas: components['schemas']['Pesewas'] = 127500;
export const kilograms: components['schemas']['Kilograms'] = '38.400';
// @ts-expect-error a weight is a string, never a JSON number
export const badKilograms: components['schemas']['Kilograms'] = 38.4;

// Reads and writes partition the contract.
export const read: QueryOperationId = 'listProducts';
export const write: MutationOperationId = 'archiveProduct';
// @ts-expect-error a mutation is not a query operation
export const notRead: QueryOperationId = 'archiveProduct';

export type ProductPage = OperationData<'listProducts'>;
