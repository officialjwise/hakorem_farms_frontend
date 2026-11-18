import type { components } from '@hakorem/api-client';
import { toE164 } from '../../lib/phone';
import { fill, word, type Words } from '../../lib/words';

type QuoteRequest = components['schemas']['PublicQuoteRequest'];

/** What the buyer types into the request-for-quote form, as typed. */
export interface RequestDraft {
  name: string;
  phone: string;
  email: string;
  requirements: string;
  crates: string;
  neededBy: string;
  deliveryArea: string;
  consent: boolean;
}

export const EMPTY_REQUEST: RequestDraft = {
  name: '',
  phone: '',
  email: '',
  requirements: '',
  crates: '',
  neededBy: '',
  deliveryArea: '',
  consent: false,
};

export type RequestErrors = Partial<Record<keyof RequestDraft, string>>;

/** `PublicQuoteRequest.requirements` is at most 2000 characters, the crates line included. */
export const REQUIREMENTS_MAX = 2000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHOLE = /^[1-9]\d{0,5}$/;

/**
 * `PublicQuoteRequest` has no quantity field (contract 2.5.0): how many crates the buyer wants is written
 * into the requirements they send, on its own line, in the shop's words. The farm reads it there; nothing is
 * worked out from it.
 */
export function requirementsSent(draft: RequestDraft, words: Words): string {
  const crates = draft.crates.trim();
  const said = draft.requirements.trim();
  if (crates === '') return said;
  return `${said}\n${fill(word(words, 'quoteRequest.cratesLine'), { crates })}`;
}

/**
 * What is missing or wrong before the request is sent, in words. Every check is the server's too; this only
 * saves a slow round trip on a weak connection. `today` is the Accra date (`YYYY-MM-DD`).
 */
export function checkRequest(draft: RequestDraft, words: Words, today: string): RequestErrors {
  const e = (key: string) => word(words, `quoteRequest.errors.${key}`);
  const errors: RequestErrors = {};
  if (draft.name.trim() === '') errors.name = e('name');
  if (toE164(draft.phone) === null) errors.phone = e('phone');
  if (draft.email.trim() !== '' && !EMAIL.test(draft.email.trim())) errors.email = e('email');
  if (draft.requirements.trim() === '') errors.requirements = e('requirements');
  else {
    const length = requirementsSent(draft, words).length;
    if (length > REQUIREMENTS_MAX)
      errors.requirements = fill(e('requirementsLong'), { max: REQUIREMENTS_MAX, count: length });
  }
  if (draft.crates.trim() !== '' && !WHOLE.test(draft.crates.trim())) errors.crates = e('crates');
  if (draft.neededBy !== '' && draft.neededBy < today) errors.neededBy = e('neededBy');
  if (!draft.consent) errors.consent = e('consent');
  return errors;
}

/** The request as the contract takes it: optional fields left out when empty, the phone in E.164. */
export function toQuoteRequest(draft: RequestDraft, words: Words): QuoteRequest {
  const email = draft.email.trim();
  const area = draft.deliveryArea.trim();
  return {
    contactName: draft.name.trim(),
    contactPhone: toE164(draft.phone) ?? draft.phone.trim(),
    ...(email === '' ? {} : { contactEmail: email }),
    requirements: requirementsSent(draft, words),
    ...(draft.neededBy === '' ? {} : { neededBy: draft.neededBy }),
    ...(area === '' ? {} : { deliveryArea: area }),
    consentToContact: draft.consent,
  };
}

/** Today's date in Accra (UTC all year, ADR 0027), as the date input compares it. */
export function accraToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
