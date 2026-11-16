/**
 * Words for the storefront's client components. Server components translate with `getT()` and pass plain
 * strings to client leaves (ADR 0015), so no i18n runtime ships to the browser. A client leaf with many
 * strings takes a slice of the `storefront` namespace as an object, and fills its `{{name}}` slots here.
 */
export type Words = { readonly [key: string]: string | Words };

/** Fills `{{name}}` slots. A missing value leaves the slot visible, so a forgotten one shows in review. */
export function fill(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (slot, name: string) =>
    name in values ? String(values[name]) : slot,
  );
}

/** One string from a slice, by a dotted path. A missing one is the path, so it shows in review. */
export function word(words: Words, path: string): string {
  let node: string | Words | undefined = words;
  for (const part of path.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : path;
}

/** The `_one` or `_other` form of a counted string, as the catalogue writes them, with `{{count}}` filled. */
export function counted(
  words: Words,
  path: string,
  count: number,
  values: Record<string, string> = {},
): string {
  return fill(word(words, `${path}_${count === 1 ? 'one' : 'other'}`), { ...values, count });
}

/** A refusal in the shop's words, by its code, or the server's own sentence, or a plain fallback. */
export function refusal(words: Words, error: { code: string; message: string } | null): string {
  if (error === null) return '';
  const said = word(words, `refusals.${error.code}`);
  if (said !== `refusals.${error.code}`) return said;
  return error.message.trim() === '' ? word(words, 'refusals.fallback') : error.message;
}

/** The strings under a path, in order: a list in the catalogue, such as the regions. */
export function wordList(words: Words, path: string): string[] {
  let node: string | Words | undefined = words;
  for (const part of path.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return typeof node === 'object'
    ? Object.values(node).filter((v): v is string => typeof v === 'string')
    : [];
}
