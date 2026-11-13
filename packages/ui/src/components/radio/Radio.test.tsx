import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FieldGroup } from '../field-group/FieldGroup';
import { Radio, RadioGroup } from './Radio';

function Payment({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('cash');
  return (
    <>
      <RadioGroup
        asChild
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      >
        <FieldGroup label="Payment method">
          <Radio value="cash" label="Cash" />
          <Radio value="momo" label="Mobile money" hint="MTN, Vodafone or AirtelTigo" />
          <Radio value="card" label="Card" disabled />
        </FieldGroup>
      </RadioGroup>
      <button type="button">After</button>
    </>
  );
}

describe('Radio', () => {
  it('labels each option by its own text and describes it by its hint', () => {
    render(<Payment />);
    expect(screen.getByRole('radio', { name: 'Mobile money' })).toHaveAccessibleDescription(
      'MTN, Vodafone or AirtelTigo',
    );
  });

  it('selects by click', async () => {
    const onChange = vi.fn();
    render(<Payment onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile money' }));
    expect(onChange).toHaveBeenCalledWith('momo');
    expect(screen.getByRole('radio', { name: 'Mobile money' })).toBeChecked();
  });

  it('keyboard path: Tab enters on the selected option, arrows move focus, disabled is skipped, Tab leaves', async () => {
    render(<Payment />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Mobile money' })).toHaveFocus();
    // Selecting on arrow is Radix's focus handler; jsdom does not fire it, so the Chromium story asserts it.
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('ignores a disabled option', async () => {
    const onChange = vi.fn();
    render(<Payment onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('throws when the group has no name', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <RadioGroup>
          <Radio value="cash" label="Cash" />
        </RadioGroup>,
      ),
    ).toThrow(/no name/);
    quiet.mockRestore();
  });

  it('accepts an aria-label as the group name', () => {
    render(
      <RadioGroup aria-label="Payment method">
        <Radio value="cash" label="Cash" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Payment method' })).toBeInTheDocument();
  });

  it('throws on a blank label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <RadioGroup aria-label="Payment method">
          <Radio value="cash" label=" " />
        </RadioGroup>,
      ),
    ).toThrow(/label/);
    quiet.mockRestore();
  });
});
