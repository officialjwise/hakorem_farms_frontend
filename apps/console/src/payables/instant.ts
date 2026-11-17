/** Today in Accra, which is UTC all year (ADR 0027), as the contract's `date`. */
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * The day and the 24-hour time typed, as the contract's date-time. Accra is UTC all year (ADR 0027), so the
 * time the person typed is the instant, with `Z`: no arithmetic, the string is the instant. Anything else
 * is null, and the screen says what to type.
 */
export function toInstant(day: string, time: string): string | null {
  const typed = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(typed)) return null;
  return `${day}T${typed}:00Z`;
}
