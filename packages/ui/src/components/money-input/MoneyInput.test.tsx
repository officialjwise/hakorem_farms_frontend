import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field } from '../field/Field';
import { MoneyInput, parsePesewas, sanitizeMoney } from './MoneyInput';

function Harness({
  initial = null,
  onValue,
}: {
  initial?: number | null;
  onValue?: (v: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <Field label="Price (GH₵)" hint="Per head.">
      <MoneyInput
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onValue?.(v);
        }}
      />
    </Field>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Price (GH₵)' });

describe('parsePesewas', () => {
  it.each([
    ['0', 0],
    ['0.5', 50],
    ['12.34', 1234],
    ['1234.5', 123450],
    ['5.', 500],
    ['.5', 50],
    ['90071992547409.91', 9007199254740991],
  ])('%j -> %i pesewas, exactly', (text, pesewas) => {
    expect(parsePesewas(text)).toBe(pesewas);
  });

  it('is null when empty', () => {
    expect(parsePesewas('')).toBeNull();
    expect(parsePesewas('.')).toBeNull();
  });

  it('refuses a value above Number.MAX_SAFE_INTEGER pesewas', () => {
    expect(parsePesewas('90071992547409.92')).toBeUndefined();
    expect(parsePesewas('90071992547410')).toBeUndefined();
  });
});

describe('sanitizeMoney', () => {
  it.each([
    ['GH₵12,3a4.567', '1234.56'],
    ['-5', '5'],
    ['1.2.3', '1.23'],
  ])('%j -> %j', (raw, expected) => {
    expect(sanitizeMoney(raw)).toBe(expected);
  });
});

describe('MoneyInput', () => {
  it('shows the cedi sign as a decorative prefix, not as typed text', () => {
    const { container } = render(<Harness initial={123450} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('GH₵');
    expect(box()).toHaveValue('1234.50');
  });

  it.each([
    ['0', 0],
    ['0.5', 50],
    ['12.34', 1234],
    ['1234.5', 123450],
  ])('typing %j reports %i pesewas', async (typed, expected) => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(box(), typed);
    expect(onValue).toHaveBeenLastCalledWith(expected);
  });

  it('normalises to two places on blur', async () => {
    render(<Harness />);
    await userEvent.type(box(), '1234.5');
    expect(box()).toHaveValue('1234.5');
    await userEvent.tab();
    expect(box()).toHaveValue('1234.50');
  });

  it('refuses the third decimal and any letter', async () => {
    render(<Harness />);
    await userEvent.type(box(), '1a2.345');
    expect(box()).toHaveValue('12.34');
  });

  it('accepts the largest safe amount and refuses the keystroke after it', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(box(), '90071992547409.91');
    expect(onValue).toHaveBeenLastCalledWith(9007199254740991);
    await userEvent.type(box(), '5');
    expect(box()).toHaveValue('90071992547409.91');
    expect(onValue).toHaveBeenLastCalledWith(9007199254740991);
  });

  it('refuses the whole-number digit that would overflow', async () => {
    render(<Harness />);
    await userEvent.type(box(), '90071992547410');
    expect(box()).toHaveValue('9007199254741');
  });

  it('is null when emptied', async () => {
    const onValue = vi.fn();
    render(<Harness initial={500} onValue={onValue} />);
    await userEvent.clear(box());
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('takes name, description, validity and required from Field, onto the input', () => {
    render(
      <Field label="Price (GH₵)" error="Enter a price." required requiredLabel="Required">
        <MoneyInput value={null} onValueChange={() => undefined} />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Price (GH₵) Required' });
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a price.');
  });

  it('keyboard path: tab reaches it, typing edits it, tab away normalises it', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(box()).toHaveFocus();
    await userEvent.keyboard('7');
    expect(box()).toHaveValue('7');
    await userEvent.tab();
    expect(box()).toHaveValue('7.00');
  });

  it('ignores typing when disabled', async () => {
    render(
      <Field label="Price (GH₵)">
        <MoneyInput value={500} onValueChange={() => undefined} disabled />
      </Field>,
    );
    await userEvent.type(box(), '9');
    expect(box()).toHaveValue('5.00');
  });
});
