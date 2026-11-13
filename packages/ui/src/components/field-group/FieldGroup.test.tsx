import { render, screen } from '@testing-library/react';
import { Checkbox } from '../checkbox/Checkbox';
import { Radio, RadioGroup } from '../radio/Radio';
import { FieldGroup } from './FieldGroup';

describe('FieldGroup', () => {
  it('names the group by its legend, with required words inside the name', () => {
    render(
      <FieldGroup label="Cuts" required requiredLabel="Required">
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    expect(screen.getByRole('group', { name: 'Cuts Required' })).toBeInTheDocument();
  });

  it('describes the group by error first, then hint, and puts no aria-invalid on the options', () => {
    render(
      <FieldGroup label="Cuts" hint="Choose at least one." error="Choose a cut.">
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    const group = screen.getByRole('group', { name: 'Cuts' });
    expect(group).toHaveAccessibleDescription('Choose a cut. Choose at least one.');
    expect(screen.getByRole('checkbox', { name: 'Wings' })).not.toHaveAttribute('aria-invalid');
    expect(group).toHaveAttribute('data-invalid', 'true');
  });

  it('is not invalid when the error is an empty string', () => {
    render(
      <FieldGroup label="Cuts" error="">
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    expect(screen.getByRole('group', { name: 'Cuts' })).not.toHaveAttribute('data-invalid');
  });

  it('sets no required attribute on the options', () => {
    render(
      <FieldGroup label="Cuts" required requiredLabel="Required">
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    expect(screen.getByRole('checkbox', { name: 'Wings' })).not.toBeRequired();
  });

  it('disables its options through the native fieldset', () => {
    render(
      <FieldGroup label="Cuts" disabled>
        <Checkbox label="Wings" />
      </FieldGroup>,
    );
    expect(screen.getByRole('checkbox', { name: 'Wings' })).toBeDisabled();
  });

  it('throws on a blank label and on required without words', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <FieldGroup label="  ">
          <span />
        </FieldGroup>,
      ),
    ).toThrow(/label/);
    expect(() =>
      render(
        // @ts-expect-error requiredLabel is required when required is set
        <FieldGroup label="Cuts" required>
          <span />
        </FieldGroup>,
      ),
    ).toThrow(/requiredLabel/);
    quiet.mockRestore();
  });

  it('becomes the radiogroup under asChild: one element, one name', () => {
    render(
      <RadioGroup asChild defaultValue="cash">
        <FieldGroup label="Payment method" hint="Choose one.">
          <Radio value="cash" label="Cash" />
          <Radio value="momo" label="Mobile money" />
        </FieldGroup>
      </RadioGroup>,
    );
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByRole('radiogroup', { name: 'Payment method' })).toHaveAccessibleDescription(
      'Choose one.',
    );
  });
});
