import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { AffixInput } from './AffixInput';

describe('AffixInput', () => {
  it('shows its affixes but names the control from the label alone', () => {
    render(
      <Field label="Price (GH₵)">
        <AffixInput prefix="GH₵" suffix="kg" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Price (GH₵)' });
    expect(input).toBeInTheDocument();
    expect(screen.getByText('GH₵', { selector: 'span' })).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('kg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes validity and description from Field', () => {
    render(
      <Field label="Weight (kg)" hint="From the scale." error="Enter a weight.">
        <AffixInput suffix="kg" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Weight (kg)' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a weight. From the scale.');
  });

  it('accepts typing, and not when disabled', async () => {
    render(
      <>
        <Field label="Open">
          <AffixInput />
        </Field>
        <Field label="Closed">
          <AffixInput disabled />
        </Field>
      </>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Open' }), '12');
    await userEvent.type(screen.getByRole('textbox', { name: 'Closed' }), '12');
    expect(screen.getByRole('textbox', { name: 'Open' })).toHaveValue('12');
    expect(screen.getByRole('textbox', { name: 'Closed' })).toHaveValue('');
  });

  it('throws without a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<AffixInput suffix="kg" />)).toThrow(/no label/);
    quiet.mockRestore();
  });
});
