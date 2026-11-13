import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from '../button/Button';
import { Spinner } from './Spinner';

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  args: { label: 'Loading stock on hand' },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Announced: a screen reader hears the label as a status. */
export const Announced: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Loading stock on hand',
    );
  },
};

/** Sizes follow density, like Button icons. */
export const Sizes: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" label="Loading small" />
      <Spinner size="md" label="Loading medium" />
      <Spinner size="lg" label="Loading large" />
    </div>
  ),
};

/** Decorative: inside a control that is already named, so it adds no announcement. */
export const Decorative: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex items-center gap-3 text-fg">
      <Spinner decorative />
      <span>Saving sale</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('status')).toBeNull();
  },
};

/** On the surfaces it sits on: page, card, recessed well and the primary button. */
export const OnSurfaces: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex flex-wrap items-center gap-4 text-fg">
      <div className="rounded-md bg-bg p-3">
        <Spinner label="Loading on page" />
      </div>
      <div className="rounded-md bg-surface p-3">
        <Spinner label="Loading on surface" />
      </div>
      <div className="rounded-md bg-surface-sunken p-3">
        <Spinner label="Loading on well" />
      </div>
      <Button loading loadingLabel="Saving">
        Save
      </Button>
    </div>
  ),
};
