import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoneyDisplay } from '../money-display/MoneyDisplay';
import { WeightDisplay } from '../weight-display/WeightDisplay';
import { CatchWeightNotice } from './CatchWeightNotice';

const RULE =
  'Each pack is weighed before dispatch and you pay for the weighed amount, at most 10% above the estimate. If it weighs less we refund the difference.';

const meta = {
  title: 'Domain/CatchWeightNotice',
  component: CatchWeightNotice,
  parameters: { matrix: true },
  args: { title: 'Priced by weight' },
} satisfies Meta<typeof CatchWeightNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On a product page, beside the price: the API's figures and its rule. */
export const ProductPage: Story = {
  args: {
    facts: [
      { term: 'Price per kg', value: <MoneyDisplay pesewas={2600} /> },
      { term: 'A pack weighs about', value: <WeightDisplay kilograms="15.000" /> },
      { term: 'It can weigh up to', value: '10% more' },
    ],
    children: RULE,
  },
};

/** At checkout, beside the total: the estimate and the most it can be without asking. */
export const Checkout: Story = {
  args: {
    title: 'Your total is an estimate',
    facts: [
      { term: 'Estimated total', value: <MoneyDisplay pesewas={45000} strong /> },
      { term: 'The most you can be charged', value: <MoneyDisplay pesewas={48000} strong /> },
    ],
    children:
      'You pay GHS 450.00 now. The chicken is weighed before dispatch: if it weighs less we refund the difference.',
  },
};

/** Inside a basket line. */
export const Compact: Story = {
  args: {
    size: 'compact',
    title: 'Weighed before dispatch',
    facts: [{ term: 'Estimated weight', value: <WeightDisplay kilograms="15.000" /> }],
  },
};

/** The title alone, when the API sends no rule. */
export const TitleOnly: Story = {
  args: { title: 'Priced by weight' },
};
