import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { parseHex } from '../../tokens/contrast';
import { colors } from '../../tokens/palette';
import { Button } from '../button/Button';
import { usePortalContainer } from './UIProvider';

const meta = {
  title: 'Foundations/UIProvider',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The red, green and blue channels of a computed colour, to compare with a palette value. */
function channels(computed: string): number[] {
  return (computed.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

/**
 * Proof only, not the Dialog component (that is built in F0c): the Radix
 * primitive wired to the themed portal target the way every overlay must be.
 */
function ProofDialog() {
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <Button variant="danger">Void sale</Button>
      </DialogPrimitive.Trigger>
      {container ? (
        <DialogPrimitive.Portal container={container}>
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-modal grid w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border border-border bg-surface p-6 text-fg shadow-lg">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Void sale GH-0042?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-fg-muted">
              A supervisor must approve this void. The sale stays on record either way.
            </DialogPrimitive.Description>
            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button variant="secondary">Keep sale</Button>
              </DialogPrimitive.Close>
              <Button variant="danger">Request approval</Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}

/**
 * The trap ADR 0004 exists to prevent: the page is light, the app is dark
 * compact, and the dialog must be dark compact too, even though it renders
 * outside the app's DOM subtree. Asserts the dialog's own computed colours and
 * control height, not the page's.
 */
export const DialogInDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <ProofDialog />,
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Void sale' }));
      const dialog = await within(document.body).findByRole('dialog', {
        name: 'Void sale GH-0042?',
      });

      // Portaled: outside the app root, inside the themed portal target.
      await expect(dialog.closest('[data-slot="ui-root"]')).toBeNull();
      await expect(dialog.closest('[data-slot="ui-portal"]')).not.toBeNull();

      // The page around it is light...
      await expect(channels(getComputedStyle(root).backgroundColor)).toEqual(
        parseHex(colors.bg.light),
      );
      // ...and the dialog is dark, in its own computed colours.
      const own = getComputedStyle(dialog);
      await expect(channels(own.backgroundColor)).toEqual(parseHex(colors.surface.dark));
      await expect(channels(own.color)).toEqual(parseHex(colors.fg.dark));

      // Compact density reaches the portal too: a medium button is 32px, not 44px.
      const keep = within(dialog).getByRole('button', { name: 'Keep sale' });
      await expect(getComputedStyle(keep).height).toBe('32px');

      await userEvent.click(keep);
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
  },
};
