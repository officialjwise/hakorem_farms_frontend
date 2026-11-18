/**
 * The phone's position as the contract's `Coordinate` (decimal degrees as a string, at most six places,
 * `^-?[0-9]{1,3}\.[0-9]{1,6}$`). The reading is cut as text, never rounded through a float format: six
 * places is about ten centimetres, far finer than a phone's fix. A reading the pattern cannot hold (an
 * exponent, a value out of range) gives null, and the proof goes without a position.
 */
export function toCoordinate(degrees: number): string | null {
  if (!Number.isFinite(degrees)) return null;
  const match = /^(-?\d{1,3})(?:\.(\d+))?$/.exec(String(degrees));
  if (match === null) return null;
  return `${match[1]}.${(match[2] ?? '0').slice(0, 6)}`;
}

/** The fix's accuracy in whole metres, as the contract's integer `positionAccuracyM`, or null. */
export function toAccuracyMetres(metres: number): number | null {
  if (!Number.isFinite(metres) || metres < 0) return null;
  const whole = Number.parseInt(String(metres), 10);
  return Number.isSafeInteger(whole) ? whole : null;
}
