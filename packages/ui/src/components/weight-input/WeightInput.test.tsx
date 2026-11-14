import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field } from '../field/Field';
import { sanitizeWeight, toKilograms, WeightInput } from './WeightInput';

function Harness({
  initial = null,
  onValue,
}: {
  initial?: string | null;
  onValue?: (v: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Field label="Weight (kg)" hint="Read from the scale.">
      <WeightInput
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onValue?.(v);
        }}
      />
    </Field>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Weight (kg)' });

describe('toKilograms', () => {
  it.each([
    ['38.4', '38.400'],
    ['0', '0.000'],
    ['1250.5', '1250.500'],
    ['5.', '5.000'],
    ['.5', '0.500'],
    ['007', '7.000'],
    ['38.123', '38.123'],
  ])('%j -> %j', (text, expected) => {
    expect(toKilograms(text)).toBe(expected);
  });

  it('is null when empty', () => {
    expect(toKilograms('')).toBeNull();
  });
});

describe('sanitizeWeight', () => {
  it.each([
    ['38.4567', '38.456'],
    ['12345678', '1234567'],
    ['-5kg', '5'],
    ['1.2.3', '1.23'],
  ])('%j -> %j', (raw, expected) => {
    expect(sanitizeWeight(raw)).toBe(expected);
  });
});

describe('WeightInput', () => {
  it('shows kg as a decorative suffix, not as typed text', () => {
    const { container } = render(<Harness initial="38.400" />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('kg');
    expect(box()).toHaveValue('38.400');
  });

  it.each([
    ['38.4', '38.400'],
    ['0', '0.000'],
    ['1250.5', '1250.500'],
  ])('typing %j reports %j', async (typed, expected) => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(box(), typed);
    expect(onValue).toHaveBeenLastCalledWith(expected);
  });

  it('normalises to exactly three places on blur', async () => {
    render(<Harness />);
    await userEvent.type(box(), '38.4');
    expect(box()).toHaveValue('38.4');
    await userEvent.tab();
    expect(box()).toHaveValue('38.400');
  });

  it('refuses the fourth decimal', async () => {
    render(<Harness />);
    await userEvent.type(box(), '38.4567');
    expect(box()).toHaveValue('38.456');
  });

  it('refuses the eighth whole digit', async () => {
    render(<Harness />);
    await userEvent.type(box(), '12345678');
    expect(box()).toHaveValue('1234567');
  });

  it('is null when emptied', async () => {
    const onValue = vi.fn();
    render(<Harness initial="5.000" onValue={onValue} />);
    await userEvent.clear(box());
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('takes name, description, validity and required from Field, onto the input', () => {
    render(
      <Field
        label="Weight (kg)"
        hint="Read from the scale."
        error="Enter a weight above zero."
        required
        requiredLabel="Required"
      >
        <WeightInput value={null} onValueChange={() => undefined} />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Weight (kg) Required' });
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a weight above zero. Read from the scale.');
  });

  it('keyboard path: tab reaches it, typing edits it, tab away normalises it', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(box()).toHaveFocus();
    await userEvent.keyboard('9');
    await userEvent.tab();
    expect(box()).toHaveValue('9.000');
  });

  it('ignores typing when disabled', async () => {
    render(
      <Field label="Weight (kg)">
        <WeightInput value="5.000" onValueChange={() => undefined} disabled />
      </Field>,
    );
    await userEvent.type(box(), '9');
    expect(box()).toHaveValue('5.000');
  });
});
