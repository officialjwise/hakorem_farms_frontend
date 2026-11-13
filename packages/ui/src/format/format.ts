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
