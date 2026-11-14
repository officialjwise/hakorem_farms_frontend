import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { UIProvider } from '../ui-provider/UIProvider';
import { Select } from './Select';

const toastLabels = { announcement: 'Notifications', close: 'Close', region: 'Notifications' };

const options = [
  { value: 'goat', label: 'Goat' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'pig', label: 'Pig', disabled: true },
];

beforeAll(() => {
  // jsdom lacks the pointer and scroll APIs Radix Select uses.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

function setup(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  return render(
    <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
      <Field
        label="Species"
        hint="What the animal is."
        error="Choose a species."
        required
        requiredLabel="Required"
      >
        <Select options={options} placeholder="Choose a species" {...props} />
      </Field>
    </UIProvider>,
  );
}

describe('Select', () => {
  it('takes its name, description, validity and required state from Field', () => {
    setup();
    const trigger = screen.getByRole('combobox', { name: 'Species Required' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Choose a species. What the animal is.');
    expect(trigger).toHaveTextContent('Choose a species');
  });

  it('opens with the keyboard and chooses with Enter', async () => {
    const onValueChange = vi.fn();
    setup({ onValueChange });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const sheep = await screen.findByRole('option', { name: 'Sheep' });
    expect(screen.getByRole('option', { name: 'Goat' })).toBeInTheDocument();
    await userEvent.click(sheep);
    expect(onValueChange).toHaveBeenCalledWith('sheep');
  });

  it('does not open when disabled', async () => {
    setup({ disabled: true });
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('throws without a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
          <Select options={options} />
        </UIProvider>,
      ),
    ).toThrow(/no label/);
    quiet.mockRestore();
  });
});
