/**
 * A record id the client makes itself, for the operations whose contract says "Client-generated" (the
 * weight records, a health event, a death report, a feed issue): a UUIDv7 (RFC 9562), so ids sort by the
 * time they were made, and a resubmission with the same id returns the first result instead of a second
 * record. The first 48 bits are the Unix time in milliseconds, then the version (7), 12 random bits, the
 * variant (10) and 62 random bits.
 */
export function newRecordId(now: number = Date.now()): string {
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);
  const rand = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  // The 48-bit millisecond time is its own 12 hex digits; no arithmetic on it is needed.
  const time = now.toString(16).padStart(12, '0').slice(-12);
  const version = `7${rand.slice(1, 4)}`;
  const variant = `${'89ab'[(random[2] ?? 0) & 0x03] ?? '8'}${rand.slice(5, 8)}`;
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-${version}-${variant}-${rand.slice(8, 20)}`;
}
