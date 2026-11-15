import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { parseHex } from '../../tokens/contrast';
import { colors } from '../../tokens/palette';
import { Button } from '../button/Button';
import { Building2, CircleCheck } from 'lucide-react';
import { Field } from '../field/Field';
import { Input } from '../input/Input';
import { Dialog, DialogActions } from './Dialog';

const meta = { title: 'Primitives/Dialog' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The red, green and blue channels of a computed colour, to compare with a palette value. */
function channels(computed: string): number[] {
  return (computed.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

const body = (
  <p className="text-control-md">
    A supervisor must approve this void. The sale stays on record either way.
  </p>
);

function VoidDialog({
  busy = false,
  failed = false,
  defaultOpen = false,
}: {
  busy?: boolean;
  failed?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <Dialog
      defaultOpen={defaultOpen}
      trigger={<Button variant="danger">Void sale</Button>}
      title="Void sale GH-0042?"
      description="This cannot be undone."
      closeLabel="Close"
      footer={
        <>
          <Button variant="secondary">Keep sale</Button>
          <Button variant="danger" loading={busy} loadingLabel="Requesting approval">
            Request approval
          </Button>
        </>
      }
    >
      {body}
      {failed ? (
        <p role="alert" className="mt-3 flex gap-2 text-control-md font-medium text-critical-fg">
          Approval request failed. The sale is still open. Check the connection and try again.
        </p>
      ) : null}
    </Dialog>
  );
}

async function openDialog(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Void sale' }));
  return within(document.body).findByRole('dialog', { name: 'Void sale GH-0042?' });
}

/** Closed: only the trigger is on the page. */
export const Closed: Story = {
  parameters: { matrix: true },
  render: () => <VoidDialog />,
};

/** Open, in the default theme and density. Axe runs on the open state. */
export const Open: Story = {
  render: () => <VoidDialog />,
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeVisible();
  },
};

/** Busy: the action button is loading, and ignores further clicks. */
export const Busy: Story = {
  globals: { theme: 'dark', density: 'comfortable' },
  render: () => <VoidDialog busy />,
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('button', { name: 'Requesting approval' }),
    ).toHaveAttribute('aria-busy', 'true');
  },
};

/** Failed: the failure stays inside the dialog as words, not only as a toast (ADR 0006). */
export const Failed: Story = {
  globals: { theme: 'light', density: 'compact' },
  render: () => <VoidDialog failed />,
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(/Approval request failed/);
  },
};

/** Narrow screens: the dialog stays inside the viewport at 360px. */
export const At360px: Story = {
  globals: { theme: 'light', density: 'comfortable' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <VoidDialog failed />,
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const box = dialog.getBoundingClientRect();
    await expect(box.left).toBeGreaterThanOrEqual(0);
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
  },
};

function ControlledDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Void sale</Button>
      <p data-testid="state">{open ? 'open' : 'closed'}</p>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Void sale GH-0042?"
        closeLabel="Close"
        footer={<Button variant="secondary">Keep sale</Button>}
      >
        {body}
      </Dialog>
    </>
  );
}

/** Keyboard path: Tab to the trigger, Enter opens, focus moves in, Escape closes and focus returns. */
export const KeyboardPath: Story = {
  render: () => <VoidDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const trigger = within(canvasElement).getByRole('button', { name: 'Void sale' });
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(document.body).findByRole('dialog', { name: 'Void sale GH-0042?' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

/** Controlled with open + onOpenChange, Radix's convention. */
export const Controlled: Story = {
  render: () => <ControlledDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Void sale' }));
    await within(document.body).findByRole('dialog');
    await expect(within(canvasElement).getByTestId('state')).toHaveTextContent('open');
  },
};

/**
 * ADR 0004's trap: the page is light, the app is dark compact, and the open
 * dialog must be dark compact too. Asserts the dialog's own computed colours
 * and control height.
 */
export const ThemedInDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <VoidDialog />,
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      const dialog = await openDialog(canvasElement);
      await expect(dialog.closest('[data-slot="ui-root"]')).toBeNull();
      await expect(dialog.closest('[data-slot="ui-portal"]')).not.toBeNull();
      const own = getComputedStyle(dialog);
      await expect(channels(own.backgroundColor)).toEqual(parseHex(colors.surface.dark));
      await expect(channels(own.color)).toEqual(parseHex(colors.fg.dark));
      const keep = within(dialog).getByRole('button', { name: 'Keep sale' });
      await expect(getComputedStyle(keep).height).toBe('32px');
      await userEvent.keyboard('{Escape}');
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
  },
};

/** The reference's modal: an icon chip beside the title, the asterisk explained, Cancel left, primary right. */
export const ReferenceShape: Story = {
  parameters: { matrix: true },
  render: () => (
    <Dialog
      defaultOpen
      trigger={<Button>New branch</Button>}
      title="New branch"
      description="A shop, farm or depot that sells or holds stock."
      closeLabel="Close"
      icon={Building2}
      requiredNote="Required field"
    >
      <div className="grid gap-3">
        <Field label="Code" required requiredLabel="Required" requiredMark="asterisk">
          <Input />
        </Field>
        <Field label="Address">
          <Input />
        </Field>
      </div>
      <DialogActions cancelLabel="Cancel" onCancel={() => undefined}>
        <Button>
          <CircleCheck aria-hidden="true" />
          Create branch
        </Button>
      </DialogActions>
    </Dialog>
  ),
};
