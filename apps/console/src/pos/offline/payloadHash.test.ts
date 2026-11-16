import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson, payloadHash, sha256Hex } from './payloadHash';

describe('JSON canonicalisation (RFC 8785)', () => {
  it('sorts keys by UTF-16 code units at every depth and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
    );
    // RFC 8785 3.2.3: "€" (U+20AC) sorts after "\r" and before the emoji's surrogate pair.
    expect(canonicalJson({ '😀': 1, '€': 2, '\r': 3, '1': 4 })).toBe(
      '{"\\r":3,"1":4,"€":2,"😀":1}',
    );
  });

  it('writes strings and integers as JSON does, and leaves undefined members out', () => {
    expect(canonicalJson({ s: 'Kwabena "Kobby" Owusu\n', n: 125000, u: undefined })).toBe(
      '{"n":125000,"s":"Kwabena \\"Kobby\\" Owusu\\n"}',
    );
    expect(() => canonicalJson(Number.NaN)).toThrow();
  });
});

describe('the payload hash (OFFLINE_SYNC 4.4)', () => {
  const sale = {
    id: '019a7b3e-4c10-7a2b-9d41-6c0f2e8b17aa',
    deviceCounter: 5,
    provisionalRef: 'P-T2-311-0005',
    occurredAt: '2026-11-13T09:40:12Z',
    lines: [
      {
        productId: '019a7a8e-a5a0-754c-8a85-5d9ed05dd67c',
        stockUnitId: '019a7a9c-0b3e-7d54-a1f8-2c7a4e9d6b10',
        quantity: '1.000',
        weightKg: '38.400',
        weightSource: 'SCALE',
        agreedUnitPricePesewas: 125000,
        varianceReasonCode: 'REGULAR_CUSTOMER',
      },
    ],
    tenders: [
      {
        paymentMethodId: '019a7a91-e8d5-704a-b582-0d78a6088656',
        amountPesewas: 125000,
        tenderedPesewas: 130000,
      },
    ],
  };

  it('is SHA-256 in lowercase hex of the canonical sale', async () => {
    const expected = createHash('sha256').update(canonicalJson(sale), 'utf8').digest('hex');
    expect(await payloadHash(sale)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('ignores the payloadHash field and the order the keys were written in', async () => {
    const { lines, tenders, ...head } = sale;
    const reordered = { payloadHash: 'old', tenders, lines, ...head };
    expect(await payloadHash(reordered)).toBe(await payloadHash(sale));
  });

  it('changes when the record is edited after the receipt was printed (section 9.8)', async () => {
    const edited = { ...sale, lines: [{ ...sale.lines[0], quantity: '6.000' }] };
    expect(await payloadHash(edited)).not.toBe(await payloadHash(sale));
  });
});
