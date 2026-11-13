import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { Switch } from './Switch';

describe('Switch', () => {
  it('takes name, description, validity and required from Field', () => {
    render(
      <Field
        label="Online visibility"
        hint="Shows in the shop."
        error="Confirm."
        required
        requiredLabel="Required"
      >
        <Switch />
      </Field>,
    );
    const sw = screen.getByRole('switch', { name: 'Online visibility Required' });
    expect(sw).toHaveAttribute('aria-required', 'true');
    expect(sw).toBeInvalid();
    expect(sw).toHaveAccessibleDescription('Confirm. Shows in the shop.');
  });

  it('keyboard path: Tab reaches it, Space toggles it', async () => {
    const onCheckedChange = vi.fn();
    render(
      <Field label="Online visibility">
        <Switch onCheckedChange={onCheckedChange} />
      </Field>,
    );
    await userEvent.tab();
    const sw = screen.getByRole('switch', { name: 'Online visibility' });
    expect(sw).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(sw).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles from the Field label', async () => {
    render(
      <Field label="Online visibility">
        <Switch />
      </Field>,
    );
    await userEvent.click(screen.getByText('Online visibility'));
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('does nothing when disabled', async () => {
    render(
      <Field label="Online visibility">
        <Switch disabled />
      </Field>,
    );
    await userEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('throws when it has no label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Switch />)).toThrow(/no label/);
    quiet.mockRestore();
  });
});
