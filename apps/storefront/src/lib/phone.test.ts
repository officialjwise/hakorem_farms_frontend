import { describe, expect, it } from 'vitest';
import { toE164 } from './phone';

describe('toE164', () => {
  it.each([
    ['024 451 2876', '+233244512876'],
    ['0244512876', '+233244512876'],
    ['244512876', '+233244512876'],
    ['+233 24 451 2876', '+233244512876'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('%s is %s', (typed, e164) => {
    expect(toE164(typed)).toBe(e164);
  });

  it.each(['', '12345', '02445128', 'phone', '+0244512876'])('"%s" is not a number', (typed) => {
    expect(toE164(typed)).toBeNull();
  });
});
