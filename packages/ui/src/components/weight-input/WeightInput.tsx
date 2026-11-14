import { useState, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { formatWeight } from '../../format/format';
import { AffixInput } from '../affix-input/AffixInput';

/** The unit shown beside the value. format.ts holds it only inside formatted text, so it is named here. */
export const WEIGHT_UNIT = 'kg';

const MAX_WHOLE_DIGITS = 7;
const PLACES = 3;

/** Digits, one '.', at most 7 whole digits and 3 places (the contract's Kilograms). Strings only. */
export function sanitizeWeight(raw: string): string {
  let seenPoint = false;
  let whole = '';
  let fraction = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (seenPoint) fraction += ch;
      else whole += ch;
    } else if (ch === '.' && !seenPoint) seenPoint = true;
  }
  // Refuse digits past the limits by keeping only the first ones.
  whole = whole.slice(0, MAX_WHOLE_DIGITS);
  fraction = fraction.slice(0, PLACES);
  return seenPoint ? `${whole}.${fraction}` : whole;
}

/** Typed text to the contract's Kilograms string (exactly three places). Empty text is null. */
export function toKilograms(text: string): string | null {
  if (text === '' || text === '.') return null;
  const [whole = '', fraction = ''] = text.split('.');
  return `${whole === '' ? '0' : whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(PLACES, '0')}`;
}

export type WeightInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'size' | 'type' | 'children' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> & {
  /** A Kilograms decimal string such as "38.400", or null when empty. Never a number. */
  value: string | null;
  onValueChange: (kilograms: string | null) => void;
};

/**
 * WeightInput. Kilograms as a three-place decimal string, never a float. The
 * unit is shown, not typed. Sanitised as typed, normalised to three places on
 * blur through formatWeight. Wired by Field (ADR 0005); put the unit in the
 * label too, because the suffix is decorative.
 */
export function WeightInput({ value, onValueChange, onFocus, onBlur, ...props }: WeightInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const settled = value === null ? '' : formatWeight(value, { context: 'export' });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = sanitizeWeight(event.target.value);
    setDraft(text);
    onValueChange(toKilograms(text));
  };

  return (
    <AffixInput
      suffix={WEIGHT_UNIT}
      inputMode="decimal"
      autoComplete="off"
      data-slot="weight-input"
      value={draft ?? settled}
      onChange={handleChange}
      onFocus={(event) => {
        setDraft(settled);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}
