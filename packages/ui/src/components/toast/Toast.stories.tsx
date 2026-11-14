import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { parseHex } from '../../tokens/contrast';
import { colors } from '../../tokens/palette';
import { useToast } from '../ui-provider/UIProvider';
import type { ToastInput } from './Toast';

const meta = { title: 'Primitives/Toast' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Raises a toast on mount, the way a screen does after an operation. A toast is
 * never the only record of a failed money or stock operation: the screen also
 * keeps persistent text, here the line under the heading.
 */
function Raise({ toast, note }: { toast: ToastInput; note: string }) {
  const { show } = useToast();
  useEffect(() => {
    show(toast);
  }, [show, toast]);
  return <p className="min-h-48 text-control-md text-fg">{note}</p>;
}

const GOOD: ToastInput = {
  tone: 'good',
  title: 'Sale GH-0042 saved',
  description: 'GH₵1,450.00 received.',
};
const WARNING: ToastInput = {
  tone: 'warning',
  title: 'Weight is above the pen average',
  description: 'Check the scale reading before saving.',
};
const CRITICAL: ToastInput = {
  tone: 'critical',
  title: 'Payment not confirmed',
  description: 'Mobile money did not respond. The sale is still open.',
};
const INFO: ToastInput = {
  tone: 'info',
  title: 'Receipt sent',
  description: 'By SMS to +233 24 451 2876.',
};

function toastStory(toast: ToastInput, note: string, tone: string): Story {
  return {
    render: () => <Raise toast={toast} note={note} />,
    play: async () => {
      const title = await within(document.body).findByText(toast.title);
      await expect(title.closest('[data-slot="toast"]')).toHaveAttribute('data-tone', tone);
    },
  };
}

/** Good: dismisses itself after six seconds. */
export const Good: Story = toastStory(GOOD, 'Sale GH-0042 is saved.', 'good');

/** Warning: stays until dismissed. */
export const Warning: Story = toastStory(WARNING, 'Weight 52.300 kg needs a check.', 'warning');

/** Critical: stays until dismissed, announced assertively. The sale line below is the persistent record. */
export const Critical: Story = toastStory(
  CRITICAL,
  'Sale GH-0042: payment not confirmed. The sale is still open.',
  'critical',
);

/** Info: dismisses itself after six seconds. */
export const Info: Story = toastStory(INFO, 'Receipt for GH-0042 sent.', 'info');

/** Persistent: a good toast with an action stays until dismissed. */
export const Persistent: Story = {
  render: () => (
    <Raise
      toast={{
        tone: 'good',
        title: 'Item removed',
        action: { label: 'Undo', onAction: () => undefined },
        persistent: true,
      }}
      note="One line removed from the sale."
    />
  ),
  play: async () => {
    await expect(await within(document.body).findByRole('button', { name: 'Undo' })).toBeVisible();
  },
};

/** At 360px the toast takes the full width and stays inside the viewport. */
export const At360px: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <Raise toast={CRITICAL} note="Sale GH-0042: payment not confirmed." />,
  play: async () => {
    const title = await within(document.body).findByText(CRITICAL.title);
    const box = (title.closest('[data-slot="toast"]') as HTMLElement).getBoundingClientRect();
    await expect(box.left).toBeGreaterThanOrEqual(0);
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
  },
};

/** Keyboard path: the toast's close button is reachable with Tab and closes with Enter. */
export const KeyboardPath: Story = {
  render: () => <Raise toast={CRITICAL} note="Sale GH-0042: payment not confirmed." />,
  play: async () => {
    const body = within(document.body);
    await body.findByText(CRITICAL.title);
    const close = body.getByRole('button', { name: 'Dismiss notification' });
    // Tab until the close button is reached, then Enter dismisses the persistent toast.
    for (let i = 0; i < 8 && document.activeElement !== close; i += 1) {
      await userEvent.tab();
    }
    await expect(close).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(body.queryByText(CRITICAL.title)).toBeNull());
  },
};

function channels(computed: string): number[] {
  return (computed.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

/** The toast is themed in dark compact even though the page around it is light (ADR 0004). */
export const ThemedInDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <Raise toast={INFO} note="Receipt for GH-0042 sent." />,
  play: async () => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      const title = await within(document.body).findByText(INFO.title);
      const toast = title.closest('[data-slot="toast"]') as HTMLElement;
      await expect(toast.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
      await expect(channels(getComputedStyle(toast).backgroundColor)).toEqual(
        parseHex(colors['info-subtle'].dark),
      );
      await expect(channels(getComputedStyle(toast).color)).toEqual(
        parseHex(colors['info-fg'].dark),
      );
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
  },
};
