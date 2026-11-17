import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CopyId } from './CopyId';

const meta = {
  title: 'Domain/CopyId',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LABELS = {
  copiedLabel: 'Copied',
  failedLabel: 'Could not copy: select it',
} as const;

/** A customer's public id with its copy button. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <CopyId value="cus_8F3K2M9Q7X4T1V6B" copyLabel="Copy cus_8F3K2M9Q7X4T1V6B" {...LABELS} />
  ),
};

/** A short code, a product's SKU. */
export const Short: Story = {
  parameters: { matrix: true },
  render: () => <CopyId value="EGG-0003" copyLabel="Copy EGG-0003" {...LABELS} />,
};

/** The extreme: a long id at 360 px wraps inside its column and stays whole. */
export const Long: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-40">
      <CopyId value="RCP-2026-DDW-T1-006201" copyLabel="Copy RCP-2026-DDW-T1-006201" {...LABELS} />
    </div>
  ),
};

/** Copied: the button's icon changes and the words say so. */
export const Copied: Story = {
  render: () => (
    <CopyId value="sup_4D2N7Q9X1K3M5P8R" copyLabel="Copy sup_4D2N7Q9X1K3M5P8R" {...LABELS} />
  ),
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy sup_4D2N7Q9X1K3M5P8R' }));
    await expect(await canvas.findByText('Copied')).toBeInTheDocument();
  },
};

/** Refused: the browser would not write to the clipboard, said in words. */
export const CopyFailed: Story = {
  render: () => (
    <CopyId value="sup_4D2N7Q9X1K3M5P8R" copyLabel="Copy sup_4D2N7Q9X1K3M5P8R" {...LABELS} />
  ),
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy sup_4D2N7Q9X1K3M5P8R' }));
    await expect(await canvas.findByText('Could not copy: select it')).toBeInTheDocument();
  },
};

/** The keyboard path: Tab reaches the button, Enter copies. */
export const KeyboardPath: Story = {
  render: () => <CopyId value="EGG-0003" copyLabel="Copy EGG-0003" {...LABELS} />,
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Copy EGG-0003' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(await canvas.findByText('Copied')).toBeInTheDocument();
  },
};
