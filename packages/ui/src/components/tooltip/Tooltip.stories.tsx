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

/**
 * Presses Tab from the top of the story, whatever an earlier story on the same page left focused or left in
 * the page: a focus point at the start of the canvas takes focus, Tab moves to the story's first tabbable
 * element, and the point is removed. Pressing Tab from wherever focus happened to be landed on the page body
 * on CI (PR 17), or on a leftover element.
 */
async function tabFromTheStory(canvasElement: HTMLElement) {
  const start = document.createElement('span');
  start.tabIndex = -1;
  canvasElement.prepend(start);
  start.focus();
  await expect(start).toHaveFocus();
  await userEvent.tab();
  start.remove();
}

/**
 * Waits until the trigger is Radix's (it carries `data-state`): the Radix half loads on first use (ADR
 * 0042), and on a cold story server it can take longer than a query's one-second default. These stories
 * test what a Tab does once it has arrived; a Tab before it arrives is the unit tests' (Tooltip.test.tsx).
 */
async function radixArrived(canvasElement: HTMLElement) {
  // Queried each time: the trigger is remounted inside Radix's when it arrives.
  await waitFor(
    () =>
      expect(within(canvasElement).getByRole('button', { name: 'Re-weigh' })).toHaveAttribute(
        'data-state',
      ),
    { timeout: 10_000 },
  );
}

/** Open on keyboard focus. Axe runs on the open state. */
export const Open: Story = {
  render: () => (
    <div className="pt-16">
      <ReweighButton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await radixArrived(canvasElement);
    await tabFromTheStory(canvasElement);
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
    await radixArrived(canvasElement);
    await tabFromTheStory(canvasElement);
    await expect(within(canvasElement).getByRole('button', { name: 'Re-weigh' })).toHaveFocus();
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
  play: async ({ canvasElement }) => {
    await radixArrived(canvasElement);
    await tabFromTheStory(canvasElement);
    await expect(within(canvasElement).getByRole('button', { name: 'Re-weigh' })).toHaveFocus();
    await within(document.body).findByRole('tooltip');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('tooltip')).toBeNull());
  },
};
