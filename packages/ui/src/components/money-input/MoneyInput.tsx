import { useState, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { CEDI_SIGN, formatMoney } from '../../format/format';
import { AffixInput } from '../affix-input/AffixInput';

const MAX_PESEWAS = BigInt(Number.MAX_SAFE_INTEGER);

/** Digits, one '.', at most two places. Strings only. */
export function sanitizeMoney(raw: string): string {
  let seenPoint = false;
  let whole = '';
  let fraction = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (seenPoint) fraction += ch;
      else whole += ch;
    } else if (ch === '.' && !seenPoint) seenPoint = true;
  }
  fraction = fraction.slice(0, 2);
  return seenPoint ? `${whole}.${fraction}` : whole;
}

/**
 * Typed text to integer pesewas by string and BigInt operations, never a float.
 * Empty text is null. Returns `undefined` when the value would exceed
 * Number.MAX_SAFE_INTEGER, which the caller refuses.
 */
export function parsePesewas(text: string): number | null | undefined {
  if (text === '' || text === '.') return null;
  const [whole = '', fraction = ''] = text.split('.');
  const pesewas = BigInt(whole === '' ? '0' : whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return pesewas > MAX_PESEWAS ? undefined : Number(pesewas);
}

export type MoneyInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'size' | 'type' | 'children' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> & {
  /** Integer pesewas, or null when empty. Never negative, as the contract's Pesewas. */
  value: number | null;
  onValueChange: (pesewas: number | null) => void;
};

/**
 * MoneyInput. Integer pesewas in and out. The operator types cedis ("12.34");
 * the cedi sign is shown, not typed. Sanitised as typed, normalised to two
 * places on blur through formatMoney, so there is one source of truth. Wired by
 * Field (ADR 0005); put the unit in the label too, because the sign is decorative.
 */
export function MoneyInput({ value, onValueChange, onFocus, onBlur, ...props }: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const settled = value === null ? '' : formatMoney(value, { context: 'export' });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = sanitizeMoney(event.target.value);
    const parsed = parsePesewas(text);
    if (parsed === undefined) return; // refuse the keystroke
    setDraft(text);
    onValueChange(parsed);
  };

  return (
    <AffixInput
      prefix={CEDI_SIGN}
      inputMode="decimal"
      autoComplete="off"
      data-slot="money-input"
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
