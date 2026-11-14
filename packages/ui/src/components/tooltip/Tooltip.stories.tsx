import type { Meta, StoryObj } from '@storybook/react-vite';
import { Scale } from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/Button';
import { Tooltip } from './Tooltip';

const meta = { title: 'Primitives/Tooltip' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A tooltip is never the only route to a fact. Tooltips do not exist on touch,
 * and the POS is touch, so the visible label "Re-weigh" carries the meaning here.
 * The tooltip only adds the shortcut.
 */
function ReweighButton({
  disabled = false,
  className,
}: {
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip content="Weigh again: F2">
      <Button variant="secondary" disabled={disabled} className={className}>
        <Scale />
        Re-weigh
      </Button>
    </Tooltip>
  );
}

/** Closed: the trigger carries the meaning on its own, with a visible label. */
export const Closed: Story = {
  parameters: { matrix: true },
  render: () => <ReweighButton />,
};

/** Open on keyboard focus. Axe runs on the open state. */
export const Open: Story = {
  render: () => (
    <div className="pt-16">
      <ReweighButton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button', { name: 'Re-weigh' })).toHaveFocus();
    const tip = await within(document.body).findByRole('tooltip');
    await expect(tip).toHaveTextContent('Weigh again: F2');
  },
};

/** Open in dark compact, to review the themed container. */
export const OpenDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => (
    <div className="pt-16">
      <ReweighButton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await within(document.body).findByRole('tooltip');
    const content = document.querySelector('[data-slot="tooltip"]');
    await expect(content?.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
    await expect(canvasElement).toBeInTheDocument();
  },
};

/** Focus: the trigger ring, forced for review. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => <ReweighButton className="demo-focus" />,
};

/** A disabled trigger cannot be focused, so it shows no tooltip. The visible label still says what it is. */
export const DisabledTrigger: Story = {
  parameters: { matrix: true },
  render: () => <ReweighButton disabled />,
};

/** Keyboard path: Tab shows it, Escape hides it. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="pt-16">
      <ReweighButton />
    </div>
  ),
  play: async () => {
    await userEvent.tab();
    await within(document.body).findByRole('tooltip');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('tooltip')).toBeNull());
  },
};
