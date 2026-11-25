import { describe, expect, it } from 'vitest';
import { readBuyer } from './buyer';

describe("a business buyer on the counter sale's receipt (2.26.0)", () => {
  it('takes a name with a GRA TIN or a Ghana Card PIN, trimmed and upper-cased', () => {
    expect(readBuyer('  Akosua Bakery ', ' c0000000042 ')).toEqual({
      buyer: { name: 'Akosua Bakery', tin: 'C0000000042' },
      problem: null,
    });
    expect(readBuyer('Kofi Mensah Catering', 'gha-123456789-0')).toEqual({
      buyer: { name: 'Kofi Mensah Catering', tin: 'GHA-123456789-0' },
      problem: null,
    });
  });

  it('names no buyer when both are empty', () => {
    expect(readBuyer('', '  ')).toEqual({ buyer: null, problem: null });
  });

  it('asks for both, and for a TIN of the right form', () => {
    expect(readBuyer('Akosua Bakery', '').problem).toBe('NAME_WITHOUT_TIN');
    expect(readBuyer('', 'C0000000042').problem).toBe('TIN_WITHOUT_NAME');
    expect(readBuyer('Akosua Bakery', 'X0000000042').problem).toBe('TIN_INVALID');
    expect(readBuyer('Akosua Bakery', 'C000000004').problem).toBe('TIN_INVALID');
    expect(readBuyer('Akosua Bakery', 'GHA-12345678-0').problem).toBe('TIN_INVALID');
    expect(readBuyer('A'.repeat(161), 'C0000000042').problem).toBe('NAME_INVALID');
    expect(readBuyer('Akosua\tBakery', 'C0000000042').problem).toBe('NAME_INVALID');
  });
});
