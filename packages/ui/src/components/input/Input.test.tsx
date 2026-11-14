import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { Input } from './Input';

describe('Input', () => {
  it('takes its name, description, validity and required state from Field', () => {
    render(
      <Field
        label="Tag number"
        hint="Printed on the ear tag."
        error="Enter a tag number."
        required
        requiredLabel="Required"
      >
        <Input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Tag number Required' });
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a tag number. Printed on the ear tag.');
  });

  it('accepts typing', async () => {
    render(
      <Field label="Tag number">
        <Input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Tag number' });
    await userEvent.type(input, 'GT-0142');
    expect(input).toHaveValue('GT-0142');
  });

  it('does nothing when disabled', async () => {
    render(
      <Field label="Tag number">
        <Input disabled defaultValue="GT-0142" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Tag number' });
    await userEvent.type(input, 'x');
    expect(input).toHaveValue('GT-0142');
  });

  it('is not reachable by keyboard when disabled, and is when enabled', async () => {
    render(
      <Field label="Tag number">
        <Input />
      </Field>,
    );
    await userEvent.tab();
    expect(screen.getByRole('textbox', { name: 'Tag number' })).toHaveFocus();
  });

  it('forwards its ref', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(
      <Field label="Tag number">
        <Input ref={ref} />
      </Field>,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('accepts an aria-label as its name outside a Field', () => {
    render(<Input aria-label="Search stock" type="search" />);
    expect(screen.getByRole('searchbox', { name: 'Search stock' })).toBeInTheDocument();
  });

  it('throws when it has no label: a placeholder is never a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Input placeholder="Tag number" />)).toThrow(/no label/);
    quiet.mockRestore();
  });
});
