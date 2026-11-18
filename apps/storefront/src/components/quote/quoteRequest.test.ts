import { describe, expect, it } from 'vitest';
import storefront from '../../../../../packages/i18n/locales/en/storefront.json';
import type { Words } from '../../lib/words';
import {
  EMPTY_REQUEST,
  REQUIREMENTS_MAX,
  accraToday,
  checkRequest,
  toQuoteRequest,
  type RequestDraft,
} from './quoteRequest';

const words = storefront as unknown as Words;
const TODAY = '2026-11-17';
const filled: RequestDraft = {
  ...EMPTY_REQUEST,
  name: ' Akosua Bakery ',
  phone: '024 451 2876',
  requirements: 'Big eggs every Friday morning',
  crates: '40',
  consent: true,
};

describe('the request-for-quote form', () => {
  it('stops an empty request in words, the consent not ticked for the buyer', () => {
    expect(checkRequest(EMPTY_REQUEST, words, TODAY)).toEqual({
      name: 'Enter your name.',
      phone: 'Enter a phone number we can call, for example 024 451 2876.',
      requirements: 'Say what you want.',
      consent: 'Tick this so we may contact you about your request.',
    });
  });

  it('writes the crates into the requirements, as the contract has no quantity', () => {
    expect(checkRequest(filled, words, TODAY)).toEqual({});
    expect(toQuoteRequest(filled, words)).toEqual({
      contactName: 'Akosua Bakery',
      contactPhone: '+233244512876',
      requirements: 'Big eggs every Friday morning\nCrates wanted: 40',
      consentToContact: true,
    });
  });

  it('sends the optional fields only when typed', () => {
    const body = toQuoteRequest(
      {
        ...filled,
        crates: '',
        email: 'akosua@example.com',
        neededBy: '2026-11-20',
        deliveryArea: 'Kasoa',
      },
      words,
    );
    expect(body).toEqual({
      contactName: 'Akosua Bakery',
      contactPhone: '+233244512876',
      contactEmail: 'akosua@example.com',
      requirements: 'Big eggs every Friday morning',
      neededBy: '2026-11-20',
      deliveryArea: 'Kasoa',
      consentToContact: true,
    });
  });

  it('refuses part crates, a past day, a bad email and too long a request', () => {
    const errors = checkRequest(
      {
        ...filled,
        crates: '2.5',
        neededBy: '2026-11-16',
        email: 'akosua',
        requirements: 'x'.repeat(REQUIREMENTS_MAX),
      },
      words,
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(['crates', 'email', 'neededBy', 'requirements']);
    expect(errors.requirements).toBe('Keep it under 2000 characters. You have 2019.');
  });

  it('takes the Accra date, which is UTC all year', () => {
    expect(accraToday(new Date('2026-11-17T23:59:00Z'))).toBe('2026-11-17');
  });
});
