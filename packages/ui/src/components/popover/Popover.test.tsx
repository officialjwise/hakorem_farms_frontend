import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubResizeObserver } from '../../test/stubResizeObserver';
import { toastLabels } from '../../test/toastLabels';
import { Button } from '../button/Button';
import { UIProvider } from '../ui-provider/UIProvider';
import { Popover } from './Popover';

function setup(disabled = false) {
  return render(
    <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
      <Popover
        trigger={<Button disabled={disabled}>Recent weights</Button>}
        label="Recent weights for GT-0142"
      >
        <p>38.400 kg on 10 Nov</p>
      </Popover>
    </UIProvider>,
  );
}

stubResizeObserver();

describe('Popover', () => {
  it('opens from its trigger and is named by its label', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Recent weights' }));
    const popover = await screen.findByRole('dialog', { name: 'Recent weights for GT-0142' });
    expect(popover).toHaveTextContent('38.400 kg on 10 Nov');
    expect(popover.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
  });

  it('opens from the keyboard, closes with Escape and returns focus to the trigger', async () => {
    setup();
    await userEvent.tab();
    const trigger = screen.getByRole('button', { name: 'Recent weights' });
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const popover = await screen.findByRole('dialog');
    await waitFor(() => expect(popover.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('does not open from a disabled trigger', async () => {
    setup(true);
    await userEvent.click(screen.getByRole('button', { name: 'Recent weights' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on an outside click', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Recent weights' }));
    await screen.findByRole('dialog');
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('throws on a blank label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
          <Popover trigger={<Button>Open</Button>} label="  ">
            body
          </Popover>
        </UIProvider>,
      ),
    ).toThrow(/label/);
    quiet.mockRestore();
  });
});
