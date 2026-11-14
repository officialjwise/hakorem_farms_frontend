import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { FieldGroup } from '../field-group/FieldGroup';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('in a Field takes name, description, validity and required from Field', () => {
    render(
      <Field
        label="Send receipt by SMS"
        hint="Costs one SMS credit."
        error="Confirm to continue."
        required
        requiredLabel="Required"
      >
        <Checkbox />
      </Field>,
    );
    const box = screen.getByRole('checkbox', { name: 'Send receipt by SMS Required' });
    expect(box).toBeRequired();
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription('Confirm to continue. Costs one SMS credit.');
  });

  it('in a FieldGroup keeps its own visible label and hint', () => {
    render(
      <FieldGroup label="Cuts">
        <Checkbox label="Drumsticks" hint="15 kg pack" />
      </FieldGroup>,
    );
    expect(screen.getByRole('checkbox', { name: 'Drumsticks' })).toHaveAccessibleDescription(
      '15 kg pack',
    );
  });

  it('toggles by click, and by Space but not by Enter', async () => {
    const onCheckedChange = vi.fn();
    render(
      <FieldGroup label="Cuts">
        <Checkbox label="Wings" onCheckedChange={onCheckedChange} />
      </FieldGroup>,
    );
    const box = screen.getByRole('checkbox', { name: 'Wings' });
    await userEvent.click(box);
    expect(box).toBeChecked();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(box).not.toBeChecked();
    await userEvent.keyboard('{Enter}');
    expect(box).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('toggles from its label', async () => {
    render(
      <FieldGroup label="Cuts">
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    await userEvent.click(screen.getByText('Wings'));
    expect(screen.getByRole('checkbox', { name: 'Wings' })).toBeChecked();
  });

  it('shows indeterminate as mixed', () => {
    render(
      <FieldGroup label="Cuts">
        <Checkbox label="All cuts" checked="indeterminate" />
      </FieldGroup>,
    );
    expect(screen.getByRole('checkbox', { name: 'All cuts' })).toBePartiallyChecked();
  });

  it('does nothing when disabled', async () => {
    const onCheckedChange = vi.fn();
    render(
      <FieldGroup label="Cuts">
        <Checkbox label="Wings" disabled onCheckedChange={onCheckedChange} />
      </FieldGroup>,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Wings' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('throws when it has no label and no Field', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Checkbox />)).toThrow(/no label/);
    quiet.mockRestore();
  });

  it('throws on a blank label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Checkbox label="  " />)).toThrow(/blank/);
    quiet.mockRestore();
  });
});
