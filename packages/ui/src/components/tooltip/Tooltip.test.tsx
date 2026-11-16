import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubResizeObserver } from '../../test/stubResizeObserver';
import { toastLabels } from '../../test/toastLabels';
import { Button } from '../button/Button';
import { UIProvider } from '../ui-provider/UIProvider';
import { Tooltip } from './Tooltip';

stubResizeObserver();

function setup(disabled = false) {
  return render(
    <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
      <Tooltip content="Weigh again: F2">
        <Button disabled={disabled}>Re-weigh</Button>
      </Tooltip>
    </UIProvider>,
  );
}

describe('Tooltip', () => {
  it('appears on keyboard focus and describes the trigger', async () => {
    setup();
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Re-weigh' })).toHaveFocus();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Weigh again: F2');
    expect(screen.getByRole('button', { name: 'Re-weigh' })).toHaveAccessibleDescription(
      'Weigh again: F2',
    );
  });

  it('is portaled into the themed target', async () => {
    setup();
    await userEvent.tab();
    await screen.findByRole('tooltip');
    const content = document.querySelector('[data-slot="tooltip"]');
    expect(content?.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
  });

  it('closes with Escape', async () => {
    setup();
    await userEvent.tab();
    await screen.findByRole('tooltip');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('never opens from a disabled trigger, which cannot take focus', async () => {
    setup(true);
    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('throws on blank content', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
          <Tooltip content="  ">
            <Button>Re-weigh</Button>
          </Tooltip>
        </UIProvider>,
      ),
    ).toThrow(/content/);
    quiet.mockRestore();
  });
});

describe('Tooltip, loaded on first use (ADR 0042)', () => {
  it('renders the trigger before Radix arrives, and keeps keyboard focus on it when it does', async () => {
    vi.resetModules();
    const fresh = await import('./Tooltip');
    const { UIProvider: FreshProvider } = await import('../ui-provider/UIProvider');
    render(
      <FreshProvider theme="light" density="compact" toastLabels={toastLabels}>
        <fresh.Tooltip content="Weigh again: F2">
          <Button>Re-weigh</Button>
        </fresh.Tooltip>
      </FreshProvider>,
    );
    const before = screen.getByRole('button', { name: 'Re-weigh' });
    before.focus();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Weigh again: F2');
    expect(screen.getByRole('button', { name: 'Re-weigh' })).toHaveFocus();
  });
});
