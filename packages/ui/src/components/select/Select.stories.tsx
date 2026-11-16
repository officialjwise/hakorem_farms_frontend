import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { parseHex } from '../../tokens/contrast';
import { colors } from '../../tokens/palette';
import { Dialog } from '../dialog/Dialog';
import { Field } from '../field/Field';
import { Select } from './Select';

const meta = {
  title: 'Primitives/Select',
  component: Select,
  args: {
    options: [
      { value: 'goat', label: 'Goat' },
      { value: 'sheep', label: 'Sheep' },
      { value: 'pig', label: 'Pig' },
      { value: 'rabbit', label: 'Rabbit', disabled: true },
    ],
    placeholder: 'Choose a species',
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: closed, nothing chosen. */
export const Default: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species" hint="What the animal is.">
        <Select {...args} />
      </Field>
    </div>
  ),
};

/** Focus, forced so the ring can be reviewed. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species">
        <Select {...args} className="demo-focus" defaultValue="goat" />
      </Field>
    </div>
  ),
};

/** Invalid: words under the control, and a thicker border. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species" error="Choose a species.">
        <Select {...args} />
      </Field>
    </div>
  ),
};

/** Disabled: recessed, and out of the tab order. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species" hint="Set by the goods receipt.">
        <Select {...args} defaultValue="sheep" disabled />
      </Field>
    </div>
  ),
};

function channels(computed: string): number[] {
  return (computed.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

/** Open in dark compact on a light page: the list carries its own theme, and axe checks it open. */
export const OpenInDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species">
        <Select {...args} defaultValue="goat" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Species' }));
      const list = await within(document.body).findByRole('listbox');
      const content = list.closest('[data-slot="select-content"]') as HTMLElement;
      await expect(content.closest('[data-slot="ui-root"]')).toBeNull();
      await expect(content.closest('[data-slot="ui-portal"]')).not.toBeNull();
      const own = getComputedStyle(content);
      await expect(channels(own.backgroundColor)).toEqual(parseHex(colors.surface.dark));
      await expect(channels(own.color)).toEqual(parseHex(colors.fg.dark));
      const goat = within(list).getByRole('option', { name: 'Goat' });
      await expect(getComputedStyle(goat).height).toBe('32px');
      await userEvent.keyboard('{Escape}');
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
  },
};

/** Keyboard path: Tab, open with Enter, arrows, choose with Enter, focus returns to the trigger. */
export const KeyboardPath: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Species">
        <Select {...args} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const trigger = within(canvasElement).getByRole('combobox', { name: 'Species' });
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await within(document.body).findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Sheep'));
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Inside a Dialog (F9, the till's line and payment dialogs): the list opens above the Dialog's scrim, on
 * the popover layer, so its options can be pointed at and chosen. Before F9 it sat on the dropdown layer,
 * under the scrim, and a click on an option landed on the scrim.
 */
export const InsideDialog: Story = {
  render: (args) => (
    <Dialog open title="Change the item" closeLabel="Close">
      <Field label="Species">
        <Select {...args} />
      </Field>
    </Dialog>
  ),
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('combobox', { name: 'Species' }));
    const list = await page.findByRole('listbox');
    const scrim = document.querySelector('[data-slot="dialog-overlay"]');
    const layer = (element: Element | null) =>
      Number(
        element
          ? getComputedStyle(element.closest('[data-radix-popper-content-wrapper]') ?? element)
              .zIndex
          : 0,
      );
    await waitFor(() => expect(layer(list)).toBeGreaterThan(layer(scrim)));
    await userEvent.click(page.getByRole('option', { name: 'Sheep' }));
    await expect(page.getByRole('combobox', { name: 'Species' })).toHaveTextContent('Sheep');
  },
};
