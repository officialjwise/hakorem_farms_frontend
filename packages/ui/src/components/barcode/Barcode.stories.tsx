import type { Meta, StoryObj } from '@storybook/react-vite';
import { Barcode } from './Barcode';

const meta = {
  title: 'Domain/Barcode',
  component: Barcode,
  args: { value: 'LOT-2026-0412', label: 'Lot barcode' },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div data-theme="light" className="w-64 bg-surface p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Barcode>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four states: a lot, a product barcode, a short SKU, and bars without the printed value. */
export const Lot: Story = {};
export const ProductBarcode: Story = { args: { value: '6034000123456', label: 'Product barcode' } };
export const ShortSku: Story = { args: { value: 'EGG-B', label: 'SKU' } };
export const BarsOnly: Story = { args: { showValue: false } };
