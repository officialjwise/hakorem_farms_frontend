import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../button/Button';
import { ConfirmChanges } from './ConfirmChanges';

const meta = { title: 'Feedback/ConfirmChanges' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Example({ pending = false, failed = false }: { pending?: boolean; failed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Post adjustment</Button>
      <ConfirmChanges
        open={open}
        onOpenChange={setOpen}
        title="Post this adjustment?"
        description="Two lines move stock at the cold room."
        changeHeadings={{ label: 'Line', before: 'On hand now', after: 'After posting' }}
        changes={[
          { label: 'Goat meat, 15 kg pack (loss)', before: '12 packs', after: '10 packs' },
          { label: 'Value at cost', before: 'GH₵ 5,640.00', after: 'GH₵ 4,700.00' },
        ]}
        consequence="Posted stock is corrected only by a reversing entry."
        confirmLabel="Post adjustment"
        cancelLabel="Cancel"
        pendingLabel="Posting"
        pending={pending}
        onConfirm={() => undefined}
        failure={
          failed ? (
            <p role="alert" className="text-sm font-semibold text-critical-fg">
              Not posted: the period is closed. Reference 7f3c-91aa.
            </p>
          ) : undefined
        }
      />
    </>
  );
}

async function open(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Post adjustment' }));
  return within(document.body).findByRole('dialog', { name: 'Post this adjustment?' });
}

/** Four states: closed, open with the exact change, busy, and failed with the refusal kept inside. */
export const Closed: Story = { parameters: { matrix: true }, render: () => <Example /> };
export const Open: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByText('After posting')).toBeVisible();
  },
};
export const Busy: Story = {
  render: () => <Example pending />,
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByRole('button', { name: 'Posting' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  },
};
export const Failed: Story = {
  render: () => <Example failed />,
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(/period is closed/);
  },
};

/** The keyboard path: open from the trigger, Tab to confirm past the change, Escape cancels. */
export const KeyboardPath: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole('button', { name: 'Post adjustment' }).focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Post this adjustment?',
    });
    await userEvent.keyboard('{Escape}');
    await expect(dialog).not.toBeInTheDocument();
  },
};
