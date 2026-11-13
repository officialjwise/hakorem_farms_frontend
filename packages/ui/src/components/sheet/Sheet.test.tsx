import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toastLabels } from '../../test/toastLabels';
import { Button } from '../button/Button';
import { UIProvider } from '../ui-provider/UIProvider';
import { Sheet, type SheetSide } from './Sheet';

function setup(side: SheetSide) {
  return render(
    <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
      <Sheet
        side={side}
        trigger={<Button>Filters</Button>}
        title="Filter stock"
        closeLabel="Close"
        footer={<Button>Apply</Button>}
      >
        <p>Location</p>
      </Sheet>
    </UIProvider>,
  );
}

describe('Sheet', () => {
  it.each([
    ['start', 'start-0'],
    ['end', 'end-0'],
    ['bottom', 'bottom-0'],
  ] as const)('opens from the %s edge, with logical positioning', async (side, edge) => {
    setup(side);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filter stock' });
    expect(sheet).toHaveAttribute('data-side', side);
    expect(sheet.className).toContain(edge);
    expect(sheet.closest('[data-slot="ui-portal"]')).not.toBeNull();
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    setup('end');
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('closes with its close button', async () => {
    setup('start');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('throws on a blank title', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
          <Sheet side="end" title=" " closeLabel="Close" />
        </UIProvider>,
      ),
    ).toThrow(/title/);
    quiet.mockRestore();
  });
});
