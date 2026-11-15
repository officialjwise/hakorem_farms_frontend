import { render, screen } from '@testing-library/react';
import { Field } from './Field';

function silenceErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('Field', () => {
  it('associates the label with the control through a generated id', () => {
    render(
      <Field label="Weight (kg)">
        <input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Weight (kg)' });
    expect(input.id).not.toBe('');
  });

  it('gives two fields different ids', () => {
    render(
      <>
        <Field label="Weight (kg)">
          <input />
        </Field>
        <Field label="Tag number">
          <input />
        </Field>
      </>,
    );
    const [a, b] = screen.getAllByRole('textbox');
    expect(a?.id).not.toBe(b?.id);
  });

  it('describes the control by its hint', () => {
    render(
      <Field label="Weight (kg)" hint="Read from the scale, three decimals">
        <input />
      </Field>,
    );
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Read from the scale, three decimals',
    );
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and describes it by the error, error first', () => {
    render(
      <Field label="Weight (kg)" hint="Read from the scale" error="Enter a weight above zero">
        <input />
      </Field>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a weight above zero Read from the scale');
  });

  it('treats an empty error string as no error, so invalid always has words', () => {
    render(
      <Field label="Weight (kg)" error="">
        <input />
      </Field>,
    );
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('marks required with the attribute and visible text', () => {
    render(
      <Field label="Weight (kg)" required requiredLabel="Required">
        <input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Weight (kg) Required' });
    expect(input).toBeRequired();
    expect(screen.getByText('Required')).toBeVisible();
  });

  it('refuses a blank label', () => {
    const spy = silenceErrors();
    const blank: string = ' ';
    expect(() =>
      render(
        <Field label={blank}>
          <input />
        </Field>,
      ),
    ).toThrow(/non-empty label/);
    spy.mockRestore();
  });

  it('refuses a blank required label', () => {
    const spy = silenceErrors();
    const blank: string = '';
    expect(() =>
      render(
        <Field label="Weight (kg)" required requiredLabel={blank}>
          <input />
        </Field>,
      ),
    ).toThrow(/requiredLabel/);
    spy.mockRestore();
  });

  it('marks a required field with an asterisk in a modal, and keeps the words for a screen reader', () => {
    render(
      <Field label="Branch name" required requiredLabel="Required" requiredMark="asterisk">
        <input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /^Branch name\s*Required$/ });
    expect(input).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Required')).toHaveClass('sr-only');
  });
});
