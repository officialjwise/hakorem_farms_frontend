import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/Button';
import { Popover } from './Popover';

const meta = { title: 'Primitives/Popover' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function WeightsPopover({
  disabled = false,
  className,
}: {
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Popover
      trigger={
        <Button variant="secondary" disabled={disabled} className={className}>
          Recent weights
        </Button>
      }
      label="Recent weights for GT-0142"
    >
      <ul className="grid gap-1 text-control-md tabular-nums">
        <li>38.400 kg on 10 Nov</li>
        <li>36.150 kg on 3 Nov</li>
        <li>34.000 kg on 27 Oct</li>
      </ul>
    </Popover>
  );
}

/** Closed: only the trigger. */
export const Closed: Story = {
  parameters: { matrix: true },
  render: () => <WeightsPopover />,
};

/** Open, with axe running on the open state. */
export const Open: Story = {
  render: () => (
    <div className="min-h-64">
      <WeightsPopover />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Recent weights' }));
    const popover = await within(document.body).findByRole('dialog', {
      name: 'Recent weights for GT-0142',
    });
    await expect(popover).toHaveTextContent('38.400 kg on 10 Nov');
  },
};

/** Open in dark compact, to review the themed container. */
export const OpenDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => (
    <div className="min-h-64">
      <WeightsPopover />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Recent weights' }));
    const popover = await within(document.body).findByRole('dialog');
    await expect(popover.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
  },
};

/** Focus: the trigger shows its ring. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => <WeightsPopover className="demo-focus" />,
};

/** A disabled trigger cannot open it. */
export const DisabledTrigger: Story = {
  parameters: { matrix: true },
  render: () => <WeightsPopover disabled />,
};

/** Keyboard path: Tab, Enter opens and moves focus in, Escape closes and returns focus. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="min-h-64">
      <WeightsPopover />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const trigger = within(canvasElement).getByRole('button', { name: 'Recent weights' });
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const popover = await within(document.body).findByRole('dialog');
    await waitFor(() => expect(popover.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
