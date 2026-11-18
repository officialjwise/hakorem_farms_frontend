/**
 * The mock serves every planned screen (the F2 gate): every one of the contract's 600 operations has a
 * route on the real Prism mock, and every read answers with JSON from the contract's own examples. The
 * list of operations is the generated manifest, so a new operation in a later contract is covered without
 * editing this file.
 */
import { operationManifest } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';

const MOCK = 'http://127.0.0.1:4010';
const SOME_ID = '019a7a8d-137d-74bf-b9f8-54cda260cdab';
/** One credential per realm of the contract's security schemes. Prism only checks that they are present. */
const CREDENTIALS = {
  Cookie: '__Host-hk_s_at=x; __Host-hk_c_at=x; __Host-hk_i_at=x',
  'X-Device-Credential': 'x',
};

const operations = Object.entries(operationManifest);
const reads = operations.filter(([, operation]) => operation.method === 'get');

async function ask(method: string, path: string): Promise<Response> {
  return fetch(`${MOCK}${path.replace(/\{[^}]+\}/g, SOME_ID)}`, {
    method: method.toUpperCase(),
    headers: { ...CREDENTIALS, 'Content-Type': 'application/json' },
    ...(method === 'get' ? {} : { body: '{}' }),
  });
}

describe('the Prism mock covers the whole contract', () => {
  it('lists the operations it is going to ask for', () => {
    // 646 published in contract 2.12.0 (CONTRACT_CHANGELOG): 600 in 1.17.0; 1.21.0 adds eight tiles and two
    // label reads (610); 1.23.0 adds the price list preview (611); 1.26.0 the sixteen care operations (627);
    // 1.27.0 the three unit conversions (630); 1.29.0 the payout details read (631); 1.30.0 three purchase
    // operations (634); 1.31.0 the tag lookup (635); 1.54.0 the shop's public profile (636); 2.4.0 the six
    // supplier claim operations (642); 2.8.0 the late count of a force-closed shift (643); 2.9.0 the
    // supplier's balance (644); 2.12.0 who holds a price list, both ways (646, CR-041).
    expect(operations.length).toBe(646);
    expect(reads.length).toBeGreaterThan(250);
  });

  it('has a route for every operation, not Prism no-route answer', async () => {
    const missing: string[] = [];
    for (const [id, operation] of operations) {
      const response = await ask(operation.method, operation.path);
      const type = ((await response.json().catch(() => ({}))) as { type?: string }).type ?? '';
      if (type.includes('NO_PATH_MATCHED') || type.includes('NO_METHOD_MATCHED')) missing.push(id);
    }
    expect(missing).toEqual([]);
  }, 120_000);

  it('answers every read with JSON from the contract: 200, or the contract own 400 for a required query parameter', async () => {
    const answers = { ok: 0, validation: [] as string[], other: [] as string[] };
    for (const [id, operation] of reads) {
      const response = await ask('get', operation.path);
      const body = (await response.json()) as { error?: { code?: string } };
      if (response.status === 200) answers.ok += 1;
      else if (response.status === 400 && body.error?.code === 'VALIDATION_FAILED') {
        answers.validation.push(id);
      } else answers.other.push(`${id} ${response.status}`);
    }
    expect(answers.other).toEqual([]);
    expect(answers.ok + answers.validation.length).toBe(reads.length);
    expect(answers.ok).toBeGreaterThan(230);
  }, 120_000);
});
