import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toastLabels } from '../../test/toastLabels';
import { Button } from '../button/Button';
import { UIProvider } from '../ui-provider/UIProvider';
import { Dialog, type DialogProps } from './Dialog';

function setup(props: Partial<DialogProps> = {}) {
  return render(
    <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
      <Dialog
        trigger={<Button>Void sale</Button>}
        title="Void sale GH-0042?"
        description="This cannot be undone."
        closeLabel="Close"
        footer={<Button>Request approval</Button>}
        {...props}
      >
        <p>A supervisor must approve.</p>
      </Dialog>
    </UIProvider>,
  );
}

describe('Dialog', () => {
  it('opens from its trigger, named by its title and described by its description', async () => {
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    const dialog = await screen.findByRole('dialog', { name: 'Void sale GH-0042?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('portals into the themed target, outside the app root', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
    expect(dialog.closest('[data-slot="ui-root"]')).toBeNull();
  });

  it('closes with Escape', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes with its close button, named by closeLabel', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes on an outside click', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    await screen.findByRole('dialog');
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus in on open and returns it to the trigger on close', async () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Void sale' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('is controlled with open and onOpenChange', async () => {
    const onOpenChange = vi.fn();
    setup({ open: true, onOpenChange, trigger: undefined });
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has no description reference when none is given', async () => {
    setup({ description: undefined });
    await userEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    expect(await screen.findByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('throws on a blank title or close label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => setup({ title: '   ' })).toThrow(/title/);
    expect(() => setup({ closeLabel: ' ' })).toThrow(/closeLabel/);
    quiet.mockRestore();
  });
});
