/**
 * A phone number as a Ghanaian customer types it, in the E.164 form the contract takes (`PhoneNumber`:
 * +233 then nine digits for Ghana). "024 451 2876", "0244512876", "244512876" and "+233 24 451 2876" are
 * all +233244512876. A number that already starts with + is kept as typed, spaces removed. Anything else
 * is null, and the form says so before anything is sent.
 */
export function toE164(typed: string): string | null {
  const compact = typed.replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  if (/^0\d{9}$/.test(compact)) return `+233${compact.slice(1)}`;
  if (/^[2-5]\d{8}$/.test(compact)) return `+233${compact}`;
  return null;
}

/**
 * An E.164 number as a Ghanaian reads it aloud: +233244512876 is "024 451 2876". A number from another
 * country is shown as the contract gives it.
 */
export function phoneForDisplay(e164: string): string {
  const ghana = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return ghana === null ? e164 : `0${ghana[1]} ${ghana[2]} ${ghana[3]}`;
}

/** The `tel:` address of an E.164 number: dialled as it is, from any country. */
export function telHref(e164: string): string {
  return `tel:${e164}`;
}

/** A WhatsApp chat with the number: `wa.me` takes the international number as digits only. */
export function whatsAppHref(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}
