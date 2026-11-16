/**
 * The offline sale's `payloadHash` (OFFLINE_SYNC.md 4.4): SHA-256, as 64 lowercase hex characters, of the
 * sale exactly as it is sent, without the `payloadHash` field, in the JSON Canonicalization Scheme
 * (RFC 8785): object keys sorted by their UTF-16 code units, no insignificant whitespace, strings escaped
 * as JSON.stringify escapes them, and numbers as ECMAScript writes them (every amount is an integer and
 * every weight and quantity a string, so no number needs more). The server recomputes it and refuses a
 * sale whose hash differs (`REJECTED_INTEGRITY`).
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };

/** RFC 8785. An `undefined` member is left out, as JSON.stringify leaves it out of the request. */
export function canonicalJson(value: Json | undefined): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A canonical number must be finite.');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value === undefined) throw new Error('undefined has no JSON form.');
  const members = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${members.join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The hash of a sale, computed over every field but `payloadHash` itself. */
export async function payloadHash(sale: { [key: string]: Json | undefined }): Promise<string> {
  return sha256Hex(canonicalJson({ ...sale, payloadHash: undefined }));
}
