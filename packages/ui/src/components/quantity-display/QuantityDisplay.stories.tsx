import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuantityDisplay } from './QuantityDisplay';

const meta = {
  title: 'Domain/QuantityDisplay',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A normal quantity with its unit. The API's three places are kept exactly. */
export const Value: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand: <QuantityDisplay quantity="20.000" unit="broilers" strong />
    </p>
  ),
};

/** Zero on hand is a real quantity. */
export const Zero: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand: <QuantityDisplay quantity="0.000" unit="crates" />
    </p>
  ),
};

/** No count recorded. */
export const NotApplicable: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand: <QuantityDisplay quantity={null} unit="crates" notApplicableLabel="No count yet" />
    </p>
  ),
};

/** The extremes: a stock-take variance below zero, and a large count. */
export const NegativeAndLarge: Story = {
  parameters: { matrix: true },
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-2 text-fg">
      <dt className="text-fg-muted">Variance</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="-2.000" unit="head" />
      </dd>
      <dt className="text-fg-muted">Eggs</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="12500.000" unit="crates" />
      </dd>
    </dl>
  ),
};
