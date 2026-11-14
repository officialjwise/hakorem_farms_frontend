/**
 * Money and weight formatting by explicit rules (ADR 0007). No locale lookup
 * and no Intl: ICU data differs between runtimes, and a total that renders one
 * way on the server and another on the client is the failure this system
 * exists to prevent. No float arithmetic either: values are handled as
 * integers and digit strings.
 */

/** Where the value is shown, which decides symbol, spacing and grouping. */
export type FormatContext = 'interface' | 'document' | 'export';

/** U+20B5. Ships with the page in the HaKorem Cedi face. Fallback if that ever fails: GH¢, never GHS. */
export const CEDI_SIGN = 'GH₵';
export const CURRENCY_CODE = 'GHS';
/** A value that does not apply, in the interface and on documents. Exports leave the cell empty. */
export const NOT_APPLICABLE = '–';

const MINUS = '-';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function emptyFor(context: FormatContext): string {
  return context === 'export' ? '' : NOT_APPLICABLE;
}

function toPesewas(value: number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`formatMoney takes integer pesewas; got ${String(value)}.`);
  }
  return BigInt(value);
}

/**
 * Integer pesewas to text.
 *
 * | context     | 123450         | -123450         |
 * | ----------- | -------------- | --------------- |
 * | `interface` | `GH₵1,234.50`  | `-GH₵1,234.50`  |
 * | `document`  | `GHS 1,234.50` | `-GHS 1,234.50` |
 * | `export`    | `1234.50`      | `-1234.50`      |
 *
 * `null` is a value that does not apply: an en dash, or an empty export cell.
 */
export function formatMoney(
  pesewas: number | bigint | null,
  { context = 'interface' }: { context?: FormatContext } = {},
): string {
  if (pesewas === null) return emptyFor(context);
  const value = toPesewas(pesewas);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / 100n).toString();
  const fraction = (abs % 100n).toString().padStart(2, '0');
  const sign = negative ? MINUS : '';

  switch (context) {
    case 'interface':
      return `${sign}${CEDI_SIGN}${groupThousands(whole)}.${fraction}`;
    case 'document':
      return `${sign}${CURRENCY_CODE} ${groupThousands(whole)}.${fraction}`;
    case 'export':
      return `${sign}${whole}.${fraction}`;
  }
}

const WEIGHT = /^(-?)(\d+)(?:\.(\d{1,3}))?$/;

/**
 * Kilograms to text, always three decimals. The input is the decimal string the
 * database holds (NUMERIC(10,3) kg), never a JavaScript number, so nothing is
 * rounded here. More than three decimals is refused rather than rounded.
 *
 * | context     | "1250.5"        |
 * | ----------- | --------------- |
 * | `interface` | `1,250.500 kg`  |
 * | `document`  | `1,250.500 kg`  |
 * | `export`    | `1250.500`      |
 */
export function formatWeight(
  kilograms: string | null,
  { context = 'interface' }: { context?: FormatContext } = {},
): string {
  if (kilograms === null) return emptyFor(context);
  const match = WEIGHT.exec(kilograms);
  if (!match) {
    throw new TypeError(
      `formatWeight takes a kilogram decimal string with up to three places; got "${kilograms}".`,
    );
  }
  const [, minus = '', intDigits = '0', fracDigits = ''] = match;
  const whole = BigInt(intDigits).toString();
  const fraction = fracDigits.padEnd(3, '0');
  const zero = /^0+$/.test(intDigits + fracDigits);
  const sign = minus && !zero ? MINUS : '';

  if (context === 'export') return `${sign}${whole}.${fraction}`;
  return `${sign}${groupThousands(whole)}.${fraction} kg`;
}

/** How many decimal places a unit of measure shows: zero for countable units, up to three for weight and volume. */
export type QuantityPlaces = 0 | 1 | 2 | 3;

/**
 * A stock quantity (the contract's `Quantity` or `SignedQuantity`) to text.
 * The unit of measure is not part of the number: the caller shows it beside
 * it.
 *
 * Display precision follows the unit, not the wire format (owner decision
 * 2026-11-14, ADR 0007). `places` is the precision the unit declares: zero for
 * countable units (head, crates, tubers, packs) and three for weight and
 * volume. One guard: a value with a non-zero digit beyond `places` shows its
 * digits, up to the last non-zero one, so the display never lies about a half
 * crate. Nothing is rounded.
 *
 * | quantity   | places | `interface`  | `export`    |
 * | ---------- | ------ | ------------ | ----------- |
 * | `"3.000"`  | 0      | `3`          | `3`         |
 * | `"2.500"`  | 0      | `2.5`        | `2.5`       |
 * | `"1250.5"` | 3      | `1,250.500`  | `1250.500`  |
 * | `"2.050"`  | 1      | `2.05`       | `2.05`      |
 */
export function formatQuantity(
  quantity: string | null,
  { context = 'interface', places }: { context?: FormatContext; places: QuantityPlaces },
): string {
  if (quantity === null) return emptyFor(context);
  const match = WEIGHT.exec(quantity);
  if (!match) {
    throw new TypeError(
      `formatQuantity takes a decimal string with up to three places; got "${quantity}".`,
    );
  }
  const [, minus = '', intDigits = '0', fracDigits = ''] = match;
  const whole = BigInt(intDigits).toString();
  const lastSignificant = fracDigits.replace(/0+$/, '').length;
  const shown = Math.max(places, lastSignificant);
  const fraction = fracDigits.padEnd(3, '0').slice(0, shown);
  const zero = /^0+$/.test(intDigits + fracDigits);
  const sign = minus && !zero ? MINUS : '';
  const grouped = context === 'export' ? whole : groupThousands(whole);
  return fraction === '' ? `${sign}${grouped}` : `${sign}${grouped}.${fraction}`;
}

/** The business's time zone. Every timestamp is stored in UTC and shown in Accra time (SHARED_BRIEF). */
export const BUSINESS_TIME_ZONE = 'Africa/Accra';

/** An ISO 8601 instant with an offset or `Z`, as the contract's `format: date-time` sends it. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const two = (n: number) => String(n).padStart(2, '0');

/**
 * A UTC instant to Accra wall-clock text, `YYYY-MM-DD HH:mm` (ADR 0027). Africa/Accra is UTC+0 all year
 * with no daylight saving, so the conversion is the UTC fields themselves and no time-zone data or Intl is
 * needed. The form is numeric and ordered largest first, so it reads the same in every language and sorts
 * as text. Seconds are dropped; an audit screen that needs them shows the raw instant beside it.
 *
 * `null` is a time that does not apply (never signed in, not revoked): an en dash, or an empty export cell.
 * Anything that is not an instant with an offset throws, as formatMoney does for a float.
 */
export function formatDateTime(
  instant: string | null,
  { context = 'interface' }: { context?: FormatContext } = {},
): string {
  if (instant === null) return emptyFor(context);
  const ms = INSTANT.test(instant) ? Date.parse(instant) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw new TypeError(
      `formatDateTime takes an ISO 8601 instant with an offset; got "${instant}".`,
    );
  }
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}
