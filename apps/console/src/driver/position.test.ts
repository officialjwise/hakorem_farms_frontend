import { describe, expect, it } from 'vitest';
import { toAccuracyMetres, toCoordinate } from './position';

const COORDINATE = /^-?[0-9]{1,3}\.[0-9]{1,6}$/;

describe('the phone position as the contract takes it', () => {
  it.each([
    [5.70594012345, '5.705940'],
    [-0.15908, '-0.15908'],
    [5, '5.0'],
    [-179.9999999, '-179.999999'],
  ])('%d is %s', (degrees, text) => {
    expect(toCoordinate(degrees)).toBe(text);
    expect(text).toMatch(COORDINATE);
  });

  it('gives null for what the pattern cannot hold', () => {
    expect(toCoordinate(1e-7)).toBeNull();
    expect(toCoordinate(Number.NaN)).toBeNull();
    expect(toCoordinate(1234.5)).toBeNull();
  });

  it('keeps whole metres of accuracy', () => {
    expect(toAccuracyMetres(9.7)).toBe(9);
    expect(toAccuracyMetres(-1)).toBeNull();
    expect(toAccuracyMetres(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
