// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiError, NetworkError } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import refusals from '../../../../packages/i18n/locales/en/refusals.json';
import { ENTRY_NAMESPACES } from '../app/entries';
import { TILL_NAMESPACES } from '../pos/routes';
import { attachRefusalWords, inWords, inWordsWhenLoaded, type RefusalWords } from './refusals';

const contract = readFileSync(
  fileURLToPath(new URL('../../../../contract/openapi.yaml', import.meta.url)),
  'utf8',
);

/** Every code an operation lists in `x-error-codes`: the contract's documented refusals. */
function documentedCodes(): string[] {
  const found = new Set<string>();
  for (const block of contract.matchAll(/x-error-codes:\n((?:\s+- [A-Z_]+\n)+)/g)) {
    for (const line of (block[1] ?? '').matchAll(/- ([A-Z_]+)/g)) found.add(line[1] ?? '');
  }
  return [...found].sort();
}

const say: RefusalWords = (key) => {
  const [kind, code] = key.split('.');
  const table = refusals[kind as 'codes' | 'rules'] as Record<string, string>;
  return table[code ?? ''] ?? null;
};

const refusal = (code: string, message: string, details: ApiError['details'] = []) =>
  new ApiError({ status: 422, code, message, correlationId: 'ref-1', details });

describe('refusals in words (ADR 0038)', () => {
  it('has words for every code the contract documents', () => {
    const codes = documentedCodes();
    expect(codes.length).toBeGreaterThan(80);
    const missing = codes.filter((code) => say(`codes.${code}`) === null);
    expect(missing).toEqual([]);
  });

  it('says a known code in the console’s words, keeping the code and the reference', () => {
    const said = inWords(refusal('MAKER_CANNOT_CHECK', 'The maker cannot check.'), say);
    expect(said.message).toMatch(/You made this request, so you cannot approve/);
    expect(said.code).toBe('MAKER_CANNOT_CHECK');
    expect(said.correlationId).toBe('ref-1');
    expect(said).toBeInstanceOf(ApiError);
  });

  it('adds the words of each broken rule, and the server’s sentence for a rule it does not know', () => {
    const said = inWords(
      refusal('BRANCH_INVALID', 'Refused.', [
        { field: null, code: 'FARM_BRANCH', message: 'farm' },
        { field: null, code: 'SOMETHING_NEW', message: 'A new rule, in the server’s words.' },
      ]),
      say,
    );
    expect(said.message).toBe(
      'This branch cannot be closed. It is the farm, where the animals are kept. A new rule, in the server’s words.',
    );
    expect(said.details).toHaveLength(2);
  });

  it('says a known rule even when its detail names a field the screen does not have', () => {
    const said = inWords(
      refusal('BRANCH_INVALID', 'Refused.', [
        { field: '/status', code: 'FARM_BRANCH', message: 'farm' },
        { field: '/status', code: 'HOLDS_STOCK', message: 'stock' },
      ]),
      say,
    );
    expect(said.message).toBe(
      'This branch cannot be closed. It is the farm, where the animals are kept. It still holds stock: move or sell it first.',
    );
  });

  it('leaves a detail on a field to the field, in the server’s words', () => {
    const detail = { field: '/name', code: 'MIN_LENGTH', message: 'At least two letters.' };
    const said = inWords(refusal('VALIDATION_FAILED', 'Invalid.', [detail]), say);
    expect(said.message).toBe(
      'Some of what was entered is not accepted. Check the fields marked below.',
    );
    expect(said.details[0]).toEqual(detail);
  });

  it('falls back to the server’s message for a code the build does not know', () => {
    const error = refusal('A_CODE_FROM_A_LATER_CONTRACT', 'The server’s own safe sentence.');
    expect(inWords(error, say)).toBe(error);
    expect(inWords(error, say).message).toBe('The server’s own safe sentence.');
  });

  it('leaves a network failure alone: the screen says it in its own words', () => {
    const error = new NetworkError();
    expect(inWords(error, say)).toBe(error);
  });

  it('does nothing before the catalogue is attached', () => {
    const error = refusal('MAKER_CANNOT_CHECK', 'The maker cannot check.');
    expect(inWords(error, null)).toBe(error);
  });

  it('waits for the refusal words before saying a refusal, where they load on demand', async () => {
    let loaded = false;
    const detach = attachRefusalWords({
      say: (key) => (loaded ? say(key) : null),
      load: () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            loaded = true;
            resolve();
          }, 5),
        ),
    });
    const said = await inWordsWhenLoaded(refusal('MAKER_CANNOT_CHECK', 'The maker cannot check.'));
    detach();
    expect(said.message).toMatch(/You made this request, so you cannot approve/);
  });

  it('keeps the server’s sentence when the refusal words cannot be fetched', async () => {
    const detach = attachRefusalWords({
      say: () => null,
      load: () => Promise.reject(new Error('offline')),
    });
    const error = refusal('MAKER_CANNOT_CHECK', 'The maker cannot check.');
    const said = await inWordsWhenLoaded(error);
    detach();
    expect(said).toBe(error);
  });

  it('keeps the refusal and shift words out of the till’s first load, and in the back office’s', () => {
    for (const namespace of TILL_NAMESPACES) expect(ENTRY_NAMESPACES.pos).not.toContain(namespace);
    expect(ENTRY_NAMESPACES['back-office']).toContain('refusals');
  });
});
