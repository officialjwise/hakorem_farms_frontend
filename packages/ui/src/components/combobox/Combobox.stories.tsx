import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { parseHex } from '../../tokens/contrast';
import { colors } from '../../tokens/palette';
import { Field } from '../field/Field';
import { Combobox } from './Combobox';

const animals = [
  { value: 'gt-0141', label: 'GT-0141 · Goat · 38.400 kg' },
  { value: 'gt-0142', label: 'GT-0142 · Goat · 41.250 kg' },
  { value: 'gt-0150', label: 'GT-0150 · Goat · under withdrawal', disabled: true },
  { value: 'sh-0207', label: 'SH-0207 · Sheep · 52.000 kg' },
];

const meta = {
  title: 'Primitives/Combobox',
  component: Combobox,
  args: {
    options: animals,
    listLabel: 'Animals',
    noResultsLabel: 'No animal matches that tag',
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: closed and empty. */
export const Default: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal" hint="Search by tag number.">
        <Combobox {...args} />
      </Field>
    </div>
  ),
};

/** Focus, forced so the ring can be reviewed. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal">
        <Combobox {...args} className="demo-focus" defaultValue="gt-0142" />
      </Field>
    </div>
  ),
};

/** Invalid: the error is words, and the border thickens. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal" error="Choose an animal from the list.">
        <Combobox {...args} />
      </Field>
    </div>
  ),
};

/** Disabled: recessed, and out of the tab order. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal" hint="Set by the sale.">
        <Combobox {...args} defaultValue="gt-0142" disabled />
      </Field>
    </div>
  ),
};

/** Loading: the app is fetching options. The status is announced inside the list. */
export const Loading: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal">
        <Combobox
          {...args}
          options={[]}
          inputValue="gt"
          onInputValueChange={() => undefined}
          loading
          loadingLabel="Searching animals"
        />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('combobox', { name: 'Animal' });
    await userEvent.click(box);
    const status = await within(document.body).findByRole('status');
    await expect(status).toHaveTextContent('Searching animals');
    await userEvent.keyboard('{Escape}');
  },
};

/** NoResults: nothing matches, and there is no empty listbox. */
export const NoResults: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal">
        <Combobox {...args} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('combobox', { name: 'Animal' });
    await userEvent.type(box, 'zzz');
    const status = await within(document.body).findByRole('status');
    await expect(status).toHaveTextContent('No animal matches that tag');
    await expect(within(document.body).queryByRole('listbox')).toBeNull();
    await userEvent.keyboard('{Escape}');
  },
};

function channels(computed: string): number[] {
  return (computed.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

/** Open in dark compact on a light page: the list carries its own theme, and axe checks it open. */
export const OpenInDarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal">
        <Combobox {...args} defaultValue="gt-0142" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      const box = within(canvasElement).getByRole('combobox', { name: 'Animal' });
      await userEvent.click(box);
      const list = await within(document.body).findByRole('listbox', { name: 'Animals' });
      const content = list.closest('[data-slot="combobox-content"]') as HTMLElement;
      await expect(content.closest('[data-slot="ui-root"]')).toBeNull();
      await expect(content.closest('[data-slot="ui-portal"]')).not.toBeNull();
      const own = getComputedStyle(content);
      await expect(channels(own.backgroundColor)).toEqual(parseHex(colors.surface.dark));
      await expect(channels(own.color)).toEqual(parseHex(colors.fg.dark));
      // The chosen option carries a mark, not just a colour, and rows meet the compact control height.
      const chosen = within(list).getByRole('option', { name: /GT-0142/ });
      await expect(chosen).toHaveAttribute('aria-selected', 'true');
      await expect(chosen.querySelector('svg')).not.toBeNull();
      await expect(getComputedStyle(chosen).height).toBe('32px');
      await userEvent.keyboard('{Escape}');
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
  },
};

/** Keyboard path: Tab in, type, arrow, choose with Enter; Escape twice clears. Focus never leaves the input. */
export const KeyboardPath: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <Field label="Animal">
        <Combobox {...args} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const box = within(canvasElement).getByRole('combobox', { name: 'Animal' });
    await expect(box).toHaveFocus();
    await userEvent.keyboard('GT-014');
    await within(document.body).findByRole('listbox', { name: 'Animals' });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(box).toHaveAttribute(
      'aria-activedescendant',
      within(document.body).getByRole('option', { name: /GT-0142/ }).id,
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(box).toHaveValue('GT-0142 · Goat · 41.250 kg'));
    await expect(box).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Escape}{Escape}');
    await expect(box).toHaveValue('');
    await expect(box).toHaveFocus();
  },
};
