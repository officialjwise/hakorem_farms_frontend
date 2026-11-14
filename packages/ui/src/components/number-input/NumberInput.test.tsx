import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field } from '../field/Field';
import { NumberInput, sanitizeNumber } from './NumberInput';

function Harness(props: { decimals?: 0 | 1 | 2 | 3; allowNegative?: boolean; initial?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <Field label="Quantity">
      <NumberInput
        value={value}
        onValueChange={setValue}
        decimals={props.decimals}
        allowNegative={props.allowNegative}
      />
    </Field>
  );
}

describe('sanitizeNumber', () => {
  it.each([
    ['12abc3', 0, false, '123'],
    ['1.5', 0, false, '15'],
    ['1.2.3', 2, false, '1.23'],
    ['1.234', 2, false, '1.23'],
    ['-5', 0, false, '5'],
    ['-5', 0, true, '-5'],
    ['5-', 0, true, '5'],
    ['.5', 1, false, '.5'],
    ['', 2, true, ''],
  ])('%j with %i places, negatives %s -> %j', (raw, decimals, neg, expected) => {
    expect(sanitizeNumber(raw, decimals, neg)).toBe(expected);
  });
});

describe('NumberInput', () => {
  it('is a text input with a numeric keypad for whole numbers, never type=number', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('uses the decimal keypad when places are allowed', () => {
    render(<Harness decimals={2} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'decimal');
  });

  it('drops letters and extra decimals as the operator types', async () => {
    render(<Harness decimals={2} />);
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    await userEvent.type(input, '3a.1b4.99');
    expect(input).toHaveValue('3.14');
  });

  it('allows a leading minus only when negatives are allowed', async () => {
    const { unmount } = render(<Harness />);
    await userEvent.type(screen.getByRole('textbox'), '-7');
    expect(screen.getByRole('textbox')).toHaveValue('7');
    unmount();
    render(<Harness allowNegative />);
    await userEvent.type(screen.getByRole('textbox'), '-7');
    expect(screen.getByRole('textbox')).toHaveValue('-7');
  });

  it('hands back the string and keeps trailing zeros exactly', async () => {
    render(<Harness decimals={3} />);
    await userEvent.type(screen.getByRole('textbox'), '38.400');
    expect(screen.getByRole('textbox')).toHaveValue('38.400');
  });

  it('takes name, description and validity from Field, onto the input', () => {
    render(
      <Field
        label="Quantity"
        hint="Heads counted."
        error="Enter a quantity."
        required
        requiredLabel="Required"
      >
        <NumberInput value="" onValueChange={() => undefined} />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Quantity Required' });
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a quantity. Heads counted.');
  });

  it('keyboard path: tab reaches it and typing edits it', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    await userEvent.keyboard('20');
    expect(screen.getByRole('textbox')).toHaveValue('20');
  });

  it('ignores typing when disabled', async () => {
    render(
      <Field label="Quantity">
        <NumberInput value="5" onValueChange={() => undefined} disabled />
      </Field>,
    );
    await userEvent.type(screen.getByRole('textbox'), '9');
    expect(screen.getByRole('textbox')).toHaveValue('5');
  });
});
