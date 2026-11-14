import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field } from '../field/Field';
import { UIProvider } from '../ui-provider/UIProvider';
import { Combobox } from './Combobox';

const toastLabels = { announcement: 'Notifications', close: 'Close', region: 'Notifications' };

const options = [
  { value: 'gt-0141', label: 'GT-0141' },
  { value: 'gt-0142', label: 'GT-0142' },
  { value: 'gt-0150', label: 'GT-0150', disabled: true },
  { value: 'gt-0207', label: 'GT-0207' },
];

function Harness({
  loadingLabel,
  ...props
}: {
  disabled?: boolean;
  inputValue?: string;
  onInputValueChange?: (text: string) => void;
  /** Passing it puts the combobox in its loading state. */
  loadingLabel?: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  const loadingProps = loadingLabel === undefined ? {} : { loading: true as const, loadingLabel };
  return (
    <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
      <Field label="Animal" hint="Search by tag.">
        <Combobox
          options={options}
          listLabel="Animals"
          noResultsLabel="No animal found"
          value={value}
          onValueChange={setValue}
          {...props}
          {...loadingProps}
        />
      </Field>
      <span data-testid="value">{value ?? 'none'}</span>
    </UIProvider>
  );
}

const box = () => screen.getByRole('combobox', { name: 'Animal' });

describe('Combobox', () => {
  it('is named and described by Field', () => {
    render(<Harness />);
    expect(box()).toHaveAccessibleDescription('Search by tag.');
    expect(box()).toHaveAttribute('aria-autocomplete', 'list');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
  });

  it('ArrowDown opens the list and moves through enabled options, wrapping', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('listbox', { name: 'Animals' });
    expect(box()).toHaveAttribute('aria-controls', list.id);
    const [first, second] = screen.getAllByRole('option');
    expect(box()).toHaveAttribute('aria-activedescendant', first?.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-activedescendant', second?.id);
    // GT-0150 is disabled, so the next stop is GT-0207, then it wraps.
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'GT-0207' }).id,
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-activedescendant', first?.id);
    await userEvent.keyboard('{ArrowUp}');
    expect(box()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'GT-0207' }).id,
    );
  });

  it('Home and End jump to the first and last enabled option', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{End}');
    expect(box()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'GT-0207' }).id,
    );
    await userEvent.keyboard('{Home}');
    expect(box()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'GT-0141' }).id,
    );
  });

  it('Enter chooses, closes and puts the label in the box, keeping focus', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('gt-0142');
    expect(box()).toHaveValue('GT-0142');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveFocus();
  });

  it('typing filters by contains, case-insensitively', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'gt-02');
    expect(await screen.findAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'GT-0207' })).toBeInTheDocument();
  });

  it('says so when nothing matches, without an empty listbox', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'zzz');
    expect(await screen.findByRole('status')).toHaveTextContent('No animal found');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box()).not.toHaveAttribute('aria-controls');
  });

  it('Escape closes, and a second Escape clears the box and the value', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveValue('GT-0141');
    await userEvent.keyboard('{Escape}');
    expect(box()).toHaveValue('');
    expect(screen.getByTestId('value')).toHaveTextContent('none');
  });

  it('Tab closes without choosing', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Tab}');
    expect(screen.getByTestId('value')).toHaveTextContent('none');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('abandons half-typed text on blur', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'GT-01');
    await userEvent.tab();
    expect(box()).toHaveValue('');
  });

  it('chooses by click, and marks the chosen option', async () => {
    render(<Harness />);
    await userEvent.click(box());
    await userEvent.click(await screen.findByRole('option', { name: 'GT-0207' }));
    expect(screen.getByTestId('value')).toHaveTextContent('gt-0207');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'GT-0207' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('announces loading, and leaves the options as the app gave them when text is controlled', async () => {
    render(
      <Harness
        inputValue="zz"
        onInputValueChange={() => undefined}
        loadingLabel="Searching animals"
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByRole('status')).toHaveTextContent('Searching animals');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('does not open when disabled', async () => {
    render(<Harness disabled />);
    await userEvent.click(box());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('throws without a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
          <Combobox options={options} listLabel="Animals" noResultsLabel="None" />
        </UIProvider>,
      ),
    ).toThrow(/no label/);
    quiet.mockRestore();
  });
});
