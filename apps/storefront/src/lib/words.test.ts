import { describe, expect, it } from 'vitest';
import { counted, fill, refusal, word, wordList, type Words } from './words';
import { listingHref } from '../components/Listing';
import { percentText } from './present';

const words: Words = {
  cart: { items_one: 'item', items_other: 'items', title: 'Your basket' },
  refusals: { CART_EMPTY: 'Your basket is empty.', fallback: 'Something went wrong.' },
  regions: { a: 'Greater Accra', b: 'Ashanti' },
};

describe('words for client leaves', () => {
  it('reads by path, fills slots, and counts', () => {
    expect(word(words, 'cart.title')).toBe('Your basket');
    expect(word(words, 'cart.missing')).toBe('cart.missing');
    expect(fill('Hello {{name}}, {{other}}', { name: 'Ama' })).toBe('Hello Ama, {{other}}');
    expect(counted(words, 'cart.items', 1)).toBe('item');
    expect(counted(words, 'cart.items', 3)).toBe('items');
    expect(wordList(words, 'regions')).toEqual(['Greater Accra', 'Ashanti']);
  });

  it('a refusal in the shop’s words, else the server’s sentence, else a fallback', () => {
    expect(refusal(words, { code: 'CART_EMPTY', message: 'x' })).toBe('Your basket is empty.');
    expect(refusal(words, { code: 'NEW_CODE', message: 'Said by the server.' })).toBe(
      'Said by the server.',
    );
    expect(refusal(words, { code: 'NEW_CODE', message: '' })).toBe('Something went wrong.');
  });
});

describe('listing links', () => {
  it('keeps the filters, drops the default sort and the cursor unless asked', () => {
    expect(
      listingHref('/c/meat', { availability: 'IN_STOCK', cursor: 'abc' }, { sort: 'RELEVANCE' }),
    ).toBe('/c/meat?availability=IN_STOCK');
    expect(listingHref('/search', { q: 'goat' }, { cursor: 'next' })).toBe(
      '/search?q=goat&cursor=next',
    );
  });
});

describe('percent text', () => {
  it.each([
    ['10.00', '10'],
    ['12.50', '12.5'],
    ['100', '100'],
    ['7.125', '7.125'],
  ])('%s is %s', (percent, text) => {
    expect(percentText(percent)).toBe(text);
  });
});
