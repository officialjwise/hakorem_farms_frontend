import type { Meta, StoryObj } from '@storybook/react-vite';
import { PriceBandDisplay } from './PriceBandDisplay';

const labels = { toLabel: 'to', listPriceLabel: 'List price' } as const;

const meta = {
  title: 'Domain/PriceBandDisplay',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A goat: a wide band, with the list price beneath. */
export const Band: Story = {
  parameters: { matrix: true },
  render: () => (
    <PriceBandDisplay
      band={{ floorPricePesewas: 12000, ceilingPricePesewas: 195000, listPricePesewas: 85000 }}
      basisLabel="per head"
      {...labels}
    />
  ),
};

/** A fixed price: floor equals ceiling, so one figure. */
export const SinglePrice: Story = {
  parameters: { matrix: true },
  render: () => (
    <PriceBandDisplay
      band={{ floorPricePesewas: 6000, ceilingPricePesewas: 6000, listPricePesewas: 6000 }}
      basisLabel="per crate"
      {...labels}
    />
  ),
};

/** No band: sold by quote only. */
export const NotApplicable: Story = {
  parameters: { matrix: true },
  render: () => (
    <PriceBandDisplay
      band={null}
      notApplicableLabel="Priced by quote"
      basisLabel="per head"
      {...labels}
    />
  ),
};

/** The extreme: large figures priced by weight. */
export const Large: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-xs">
      <PriceBandDisplay
        band={{ floorPricePesewas: 33000, ceilingPricePesewas: 65000000, listPricePesewas: 45000 }}
        basisLabel="per 15 kg pack"
        {...labels}
      />
    </div>
  ),
};
