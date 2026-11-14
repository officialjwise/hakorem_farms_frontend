import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuantityDisplay } from './QuantityDisplay';

const meta = {
  title: 'Domain/QuantityDisplay',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A countable unit shows no decimals: precision follows the unit, not the wire format. */
export const Value: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand: <QuantityDisplay quantity="20.000" unit="broilers" places={0} strong />
    </p>
  ),
};

/** Zero on hand is a real quantity. */
export const Zero: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand: <QuantityDisplay quantity="0.000" unit="crates" places={0} />
    </p>
  ),
};

/** No count recorded. */
export const NotApplicable: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      On hand:{' '}
      <QuantityDisplay quantity={null} unit="crates" places={0} notApplicableLabel="No count yet" />
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
        <QuantityDisplay quantity="-2.000" unit="head" places={0} />
      </dd>
      <dt className="text-fg-muted">Eggs</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="12500.000" unit="crates" places={0} />
      </dd>
    </dl>
  ),
};

/** Weight and volume units declare three places, and a half crate is never hidden. */
export const PrecisionFollowsTheUnit: Story = {
  parameters: { matrix: true },
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-2 text-fg">
      <dt className="text-fg-muted">Goats</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="12.000" unit="head" places={0} />
      </dd>
      <dt className="text-fg-muted">Chicken pack</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="38.400" unit="kg" places={3} />
      </dd>
      <dt className="text-fg-muted">Half crate</dt>
      <dd className="text-end">
        <QuantityDisplay quantity="2.500" unit="crates" places={0} />
      </dd>
    </dl>
  ),
};
