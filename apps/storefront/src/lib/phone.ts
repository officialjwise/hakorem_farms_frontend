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
