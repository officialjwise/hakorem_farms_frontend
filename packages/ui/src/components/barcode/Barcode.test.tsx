import { render, screen } from '@testing-library/react';
import { Barcode } from './Barcode';
import { code128BValues, code128BWidths, isCode128B, patternFor, STOP } from './code128';

describe('Code 128 B', () => {
  it('has a symbol table of 11-module symbols and a 13-module stop', () => {
    for (let v = 0; v < STOP; v += 1) {
      expect([...patternFor(v)].reduce((s, d) => s + Number(d), 0)).toBe(11);
    }
    expect([...patternFor(STOP)].reduce((s, d) => s + Number(d), 0)).toBe(13);
  });

  it('adds the modulo-103 check symbol', () => {
    // Start B 104 + P48×1 + J42×2 + J42×3 + 1:17×4 + 2:18×5 + 3:19×6 + C35×7 = 879; 879 mod 103 = 55.
    expect(code128BValues('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
  });

  it('is start, data, check and stop in widths: 11 modules each, 13 for the stop', () => {
    const widths = code128BWidths('LOT-0412');
    expect(widths.reduce((s, w) => s + w, 0)).toBe(11 * (1 + 8 + 1) + 13);
  });

  it('refuses what set B cannot write', () => {
    expect(isCode128B('GH₵')).toBe(false);
    expect(isCode128B('')).toBe(false);
    expect(() => code128BValues('GH₵')).toThrow(/printable ASCII/);
  });
});

describe('Barcode', () => {
  it('is an image named by what it is and the value', () => {
    render(<Barcode value="LOT-0412" label="Lot barcode" />);
    expect(screen.getByRole('img', { name: 'Lot barcode: LOT-0412' })).toBeInTheDocument();
    expect(screen.getByText('LOT-0412')).toBeInTheDocument();
  });
});
