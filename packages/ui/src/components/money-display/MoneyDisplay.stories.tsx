import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoneyDisplay } from './MoneyDisplay';

const meta = {
  title: 'Domain/MoneyDisplay',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A normal amount, in the interface and on a document. */
export const Value: Story = {
  parameters: { matrix: true },
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-2 text-fg">
      <dt className="text-fg-muted">Interface</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={123450} />
      </dd>
      <dt className="text-fg-muted">Document</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={123450} context="document" />
      </dd>
      <dt className="font-semibold">Total</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={123450} strong />
      </dd>
    </dl>
  ),
};

/** Zero is a real amount, not a missing one. */
export const Zero: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      Balance due: <MoneyDisplay pesewas={0} />
    </p>
  ),
};

/** Null: the dash is hidden from screen readers, who hear the words. */
export const NotApplicable: Story = {
  parameters: { matrix: true },
  render: () => (
    <p className="text-fg">
      Approval threshold:{' '}
      <MoneyDisplay pesewas={null} notApplicableLabel="Approval always needed" />
    </p>
  ),
};

/** The extremes: an outgoing amount (direction from its own field) and a very large one. */
export const NegativeAndLarge: Story = {
  parameters: { matrix: true },
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-2 text-fg">
      <dt className="text-fg-muted">Refund</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={123450} negative />
      </dd>
      <dt className="text-fg-muted">Capital</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={9007199254740991n} strong />
      </dd>
    </dl>
  ),
};
