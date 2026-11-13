import { CEDI_SIGN, NOT_APPLICABLE, formatMoney, formatQuantity, formatWeight } from './format';

describe('formatMoney', () => {
  describe('interface (GH₵, no space)', () => {
    it.each([
      [0, 'GH₵0.00'],
      [1, 'GH₵0.01'],
      [5, 'GH₵0.05'],
      [10, 'GH₵0.10'],
      [100, 'GH₵1.00'],
      [99999, 'GH₵999.99'],
      [100000, 'GH₵1,000.00'],
      [123450, 'GH₵1,234.50'],
      [99999999, 'GH₵999,999.99'],
      [100000000, 'GH₵1,000,000.00'],
      [Number.MAX_SAFE_INTEGER, 'GH₵90,071,992,547,409.91'],
    ])('%d pesewas is %s', (pesewas, expected) => {
      expect(formatMoney(pesewas)).toBe(expected);
    });

    it.each([
      [-1, '-GH₵0.01'],
      [-123450, '-GH₵1,234.50'],
      [-100000000, '-GH₵1,000,000.00'],
    ])('negative %d pesewas is %s, ASCII minus before the sign', (pesewas, expected) => {
      expect(formatMoney(pesewas)).toBe(expected);
    });

    it('never shows a minus on zero, including negative zero', () => {
      expect(formatMoney(-0)).toBe('GH₵0.00');
      expect(formatMoney(0n)).toBe('GH₵0.00');
    });

    it('takes bigint pesewas beyond the safe-integer range', () => {
      expect(formatMoney(123456789012345678901n)).toBe('GH₵1,234,567,890,123,456,789.01');
      expect(formatMoney(-123456789012345678901n)).toBe('-GH₵1,234,567,890,123,456,789.01');
    });

    it('uses U+20B5 and U+002D, nothing locale-dependent', () => {
      expect(CEDI_SIGN).toBe('GH₵');
      expect(formatMoney(-123450).charCodeAt(0)).toBe(0x2d);
    });
  });

  describe('document (GHS, one space)', () => {
    it.each([
      [0, 'GHS 0.00'],
      [123450, 'GHS 1,234.50'],
      [-123450, '-GHS 1,234.50'],
      [100000000, 'GHS 1,000,000.00'],
    ])('%d pesewas is %s', (pesewas, expected) => {
      expect(formatMoney(pesewas, { context: 'document' })).toBe(expected);
    });
  });

  describe('export (bare number, so a spreadsheet can sum it)', () => {
    it.each([
      [0, '0.00'],
      [5, '0.05'],
      [123450, '1234.50'],
      [-123450, '-1234.50'],
      [100000000, '1000000.00'],
    ])('%d pesewas is %s', (pesewas, expected) => {
      expect(formatMoney(pesewas, { context: 'export' })).toBe(expected);
    });

    it('exports a number a spreadsheet parses to the same value', () => {
      expect(Number(formatMoney(123450, { context: 'export' }))).toBe(1234.5);
    });
  });

  it('shows a value that does not apply as an en dash, or an empty export cell', () => {
    expect(formatMoney(null)).toBe(NOT_APPLICABLE);
    expect(NOT_APPLICABLE).toBe('–');
    expect(formatMoney(null, { context: 'document' })).toBe('–');
    expect(formatMoney(null, { context: 'export' })).toBe('');
  });

  it.each([12.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuses %s, which is not integer pesewas',
    (bad) => {
      expect(() => formatMoney(bad)).toThrow(TypeError);
    },
  );
});

describe('formatWeight', () => {
  it.each([
    ['38.4', '38.400 kg'],
    ['38.400', '38.400 kg'],
    ['0', '0.000 kg'],
    ['0.005', '0.005 kg'],
    ['15', '15.000 kg'],
    ['007.5', '7.500 kg'],
    ['1250.5', '1,250.500 kg'],
    ['9999999.999', '9,999,999.999 kg'],
    ['-1.5', '-1.500 kg'],
  ])('%s kg is %s', (kg, expected) => {
    expect(formatWeight(kg)).toBe(expected);
  });

  it('never shows a minus on zero', () => {
    expect(formatWeight('-0')).toBe('0.000 kg');
    expect(formatWeight('-0.000')).toBe('0.000 kg');
  });

  it('formats the same on documents', () => {
    expect(formatWeight('1250.5', { context: 'document' })).toBe('1,250.500 kg');
  });

  it('exports a bare number with the unit left to the column header', () => {
    expect(formatWeight('1250.5', { context: 'export' })).toBe('1250.500');
    expect(formatWeight('-1.5', { context: 'export' })).toBe('-1.500');
  });

  it('shows a value that does not apply as an en dash, or an empty export cell', () => {
    expect(formatWeight(null)).toBe('–');
    expect(formatWeight(null, { context: 'export' })).toBe('');
  });

  it.each(['38.4005', '38,4', '1e3', ' 38.4', '38.', '.5', '', 'abc', '+1'])(
    'refuses "%s" rather than guessing or rounding',
    (bad) => {
      expect(() => formatWeight(bad)).toThrow(TypeError);
    },
  );
});

describe('formatQuantity', () => {
  it.each([
    ['0.000', '0.000'],
    ['3.000', '3.000'],
    ['3', '3.000'],
    ['3.5', '3.500'],
    ['1250.5', '1,250.500'],
    ['99999999999.999', '99,999,999,999.999'],
    ['-2.000', '-2.000'],
  ])('%s is %s in the interface and on documents', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
    expect(formatQuantity(input, { context: 'document' })).toBe(expected);
  });

  it('has no separator in exports', () => {
    expect(formatQuantity('1250.5', { context: 'export' })).toBe('1250.500');
    expect(formatQuantity('-1250.5', { context: 'export' })).toBe('-1250.500');
  });

  it('never shows a minus on zero', () => {
    expect(formatQuantity('-0.000')).toBe('0.000');
  });

  it('renders null as an en dash, or an empty export cell', () => {
    expect(formatQuantity(null)).toBe(NOT_APPLICABLE);
    expect(formatQuantity(null, { context: 'export' })).toBe('');
  });

  it.each(['1.2345', '1,5', 'abc', '', '1e3', ' 1.000'])(
    'refuses "%s" rather than rounding',
    (bad) => {
      expect(() => formatQuantity(bad)).toThrow(TypeError);
    },
  );
});
