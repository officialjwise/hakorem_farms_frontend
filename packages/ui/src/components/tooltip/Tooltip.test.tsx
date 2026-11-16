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

  it('keeps focus on a trigger tabbed onto after Radix arrived and before React swapped it in', async () => {
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
    // The Tooltip asked for the Radix half when it mounted; this callback runs after its own, once the
    // half has arrived and before React commits the swap: the gap CI hit on PR 17.
    // Two steps later than the import itself: after Tooltip's own callback has run (it is chained one step
    // deeper), and before React's scheduled render commits the swap.
    await import('./TooltipRadix')
      .then(() => undefined)
      .then(() => undefined)
      .then(() => before.focus());
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Weigh again: F2');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-weigh' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Re-weigh' })).not.toBe(before);
  });

  it('does not pull focus back to a trigger the person left before Radix arrived', async () => {
    vi.resetModules();
    const fresh = await import('./Tooltip');
    const { UIProvider: FreshProvider } = await import('../ui-provider/UIProvider');
    render(
      <FreshProvider theme="light" density="compact" toastLabels={toastLabels}>
        <fresh.Tooltip content="Weigh again: F2">
          <Button>Re-weigh</Button>
        </fresh.Tooltip>
        <Button>Next</Button>
      </FreshProvider>,
    );
    screen.getByRole('button', { name: 'Re-weigh' }).focus();
    screen.getByRole('button', { name: 'Next' }).focus();
    await import('./TooltipRadix');
    await waitFor(() =>
      expect(document.querySelector('[data-slot="tooltip-anchor"] button')).not.toBe(null),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });
});
