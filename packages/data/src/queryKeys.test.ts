import { isSameResource, queryKey, resourceRoot } from './queryKeys';

describe('query keys derive from the contract', () => {
  it('is the operation id, then the input', () => {
    expect(queryKey('listProducts')).toEqual(['listProducts']);
    expect(queryKey('listProducts', { query: { q: 'goat' } })).toEqual([
      'listProducts',
      { query: { q: 'goat' } },
    ]);
    expect(queryKey('getProduct', { path: { id: 'p1' } })).toEqual([
      'getProduct',
      { path: { id: 'p1' } },
    ]);
  });

  it('takes the resource from the first path segment', () => {
    expect(resourceRoot('/products/{id}/archive')).toBe('products');
    expect(resourceRoot('/stock/adjustments')).toBe('stock');
  });

  it('treats every read under the same resource as affected by a write to it', () => {
    expect(isSameResource('archiveProduct', ['listProducts', { query: {} }])).toBe(true);
    expect(isSameResource('archiveProduct', ['getProduct', { path: { id: 'p1' } }])).toBe(true);
  });

  it('leaves reads of other resources alone, and ignores keys that are not operations', () => {
    expect(isSameResource('archiveProduct', ['getCurrentSession'])).toBe(false);
    expect(isSameResource('archiveProduct', ['somethingElse'])).toBe(false);
    expect(isSameResource('archiveProduct', [])).toBe(false);
  });
});
