import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

function Harness({ start = 1, max = 5 }: { start?: number; max?: number }) {
  const [value, setValue] = useState(start);
  return (
    <QuantityStepper
      label="Packs"
      value={value}
      onValueChange={setValue}
      max={max}
      decreaseLabel="One fewer"
      increaseLabel="One more"
    />
  );
}

describe('QuantityStepper', () => {
  it('is a labelled group: minus, the number, plus', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Packs' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Packs' })).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'One fewer' })).toBeDisabled();
  });

  it('counts up and down by the buttons and by Up and Down, within its limits', async () => {
    const user = userEvent.setup();
    render(<Harness start={4} />);
    await user.click(screen.getByRole('button', { name: 'One more' }));
    expect(screen.getByRole('textbox')).toHaveValue('5');
    expect(screen.getByRole('button', { name: 'One more' })).toBeDisabled();
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('textbox')).toHaveValue('3');
  });

  it('takes typed digits only, and keeps them within its limits', async () => {
    const user = userEvent.setup();
    render(<Harness start={2} />);
    const field = screen.getByRole('textbox');
    await user.clear(field);
    await user.type(field, '9x');
    expect(field).toHaveValue('5');
  });
});
