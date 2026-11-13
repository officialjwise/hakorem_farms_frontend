import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('is a native date input holding a YYYY-MM-DD string', () => {
    render(
      <Field label="Delivery date">
        <DatePicker defaultValue="2026-12-04" />
      </Field>,
    );
    const input = screen.getByLabelText('Delivery date');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-12-04');
  });

  it('passes min and max to the browser', () => {
    render(
      <Field label="Delivery date">
        <DatePicker min="2026-12-01" max="2026-12-31" />
      </Field>,
    );
    const input = screen.getByLabelText('Delivery date');
    expect(input).toHaveAttribute('min', '2026-12-01');
    expect(input).toHaveAttribute('max', '2026-12-31');
  });

  it('takes name, description, validity and required from Field', () => {
    render(
      <Field
        label="Delivery date"
        hint="Slots open 08:00 to 17:00."
        error="Pick a date."
        required
        requiredLabel="Required"
      >
        <DatePicker />
      </Field>,
    );
    const input = screen.getByLabelText('Delivery date Required');
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Pick a date. Slots open 08:00 to 17:00.');
  });

  it('keyboard path: tab reaches it and a typed date sets the value', async () => {
    const onChange = vi.fn();
    render(
      <Field label="Delivery date">
        <DatePicker onChange={onChange} />
      </Field>,
    );
    await userEvent.tab();
    const input = screen.getByLabelText('Delivery date');
    expect(input).toHaveFocus();
    await userEvent.type(input, '2026-12-09');
    expect(input).toHaveValue('2026-12-09');
    expect(onChange).toHaveBeenCalled();
  });

  it('is skipped by the keyboard when disabled', async () => {
    render(
      <Field label="Delivery date">
        <DatePicker disabled />
      </Field>,
    );
    await userEvent.tab();
    expect(screen.getByLabelText('Delivery date')).not.toHaveFocus();
  });

  it('throws without a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<DatePicker />)).toThrow(/no label/);
    quiet.mockRestore();
  });
});
