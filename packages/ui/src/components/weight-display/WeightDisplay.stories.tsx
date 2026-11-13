import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeightDisplay } from './WeightDisplay';

const meta = {
  title: 'Domain/WeightDisplay',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A normal weight: always three places and the unit. */
export const Value: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      Last weight: <WeightDisplay kilograms="38.4" strong />
    </p>
  ),
};

/** Zero is a real weight. */
export const Zero: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      Tare: <WeightDisplay kilograms="0.000" />
    </p>
  ),
};

/** Not weighed yet: words for screen readers, a dash for the eye. */
export const NotApplicable: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      Last weight: <WeightDisplay kilograms={null} notApplicableLabel="Not weighed yet" />
    </p>
  ),
};

/** A large lot, with the document form. */
export const Large: Story = {
  parameters: { matrix: true },
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-2 text-fg">
      <dt className="text-fg-muted">Interface</dt>
      <dd className="text-end">
        <WeightDisplay kilograms="1250.500" />
      </dd>
      <dt className="text-fg-muted">Document</dt>
      <dd className="text-end">
        <WeightDisplay kilograms="1234567.000" context="document" />
      </dd>
    </dl>
  ),
};
