import { ANY, countSet, param } from './filters';

describe('stock list filters', () => {
  it('send nothing for "any", and the API field otherwise', () => {
    expect(param('status', ANY)).toEqual({});
    expect(param('status', 'POSTED')).toEqual({ status: 'POSTED' });
  });

  it('count only the filters that are set, for the pill', () => {
    expect(countSet(ANY, 'POSTED', ANY, 'loc-1')).toBe(2);
    expect(countSet(ANY)).toBe(0);
  });
});
