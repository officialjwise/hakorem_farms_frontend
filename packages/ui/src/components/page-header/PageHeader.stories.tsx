import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Plus } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../button/Button';
import { PageHeader } from './PageHeader';

const meta = {
  title: 'Layout/PageHeader',
  component: PageHeader,
  args: { title: 'Dashboard', description: 'HaKorem Farm, Kasoa and KNUST' },
  parameters: { matrix: true },
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

const refresh = {
  label: 'Refresh',
  onRefresh: () => undefined,
  refreshing: false,
  refreshingLabel: 'Refreshing',
};

/** Four states: title only, generated with refresh, refreshing, and with actions. */
export const TitleOnly: Story = { args: { description: undefined } };
export const Generated: Story = { args: { generatedAt: 'Generated 14:05, Accra time', refresh } };
export const Refreshing: Story = {
  args: { generatedAt: 'Generated 14:05, Accra time', refresh: { ...refresh, refreshing: true } },
};
export const WithActions: Story = {
  args: {
    generatedAt: 'Generated 14:05, Accra time',
    refresh,
    actions: (
      <>
        <Button variant="secondary">
          <Download aria-hidden="true" />
          Export
        </Button>
        <Button>
          <Plus aria-hidden="true" />
          New transfer
        </Button>
      </>
    ),
  },
};

/** The keyboard path: Tab reaches refresh, then each action in reading order. */
export const KeyboardPath: Story = {
  parameters: { matrix: false },
  args: WithActions.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Export' })).toHaveFocus();
  },
};
