import { describe, expect, it } from 'vitest';
import { phoneForDisplay, telHref, toE164, whatsAppHref } from './phone';

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

describe('a number the shop gives', () => {
  it('reads a Ghanaian number as it is said aloud, and any other as given', () => {
    expect(phoneForDisplay('+233244512876')).toBe('024 451 2876');
    expect(phoneForDisplay('+233200000120')).toBe('020 000 0120');
    expect(phoneForDisplay('+442079460958')).toBe('+442079460958');
  });

  it('dials the international number, and opens WhatsApp with its digits', () => {
    expect(telHref('+233244512876')).toBe('tel:+233244512876');
    expect(whatsAppHref('+233244512876')).toBe('https://wa.me/233244512876');
  });
});
