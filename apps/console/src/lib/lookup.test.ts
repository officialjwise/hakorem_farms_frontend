import { lookup, UNKNOWN } from './lookup';

describe('lookup', () => {
  const TONE = { ACTIVE: 'good', CLOSED: 'slate' } as const;
  it('reads a known value', () => {
    expect(lookup(TONE, 'ACTIVE', UNKNOWN)).toBe('good');
  });
  it('gives the fallback for a value the contract gained after this build, never undefined', () => {
    // FilePurpose gained EXPORT in contract 1.17.0: a strict map would answer undefined and crash on .tone.
    expect(lookup(TONE, 'EXPORT', UNKNOWN)).toBe(UNKNOWN);
  });
  it('is not fooled by inherited keys', () => {
    expect(lookup(TONE, 'toString', UNKNOWN)).toBe(UNKNOWN);
  });
});
