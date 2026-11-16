import type { Meta, StoryObj } from '@storybook/react-vite';
import { Beef, Bird, Egg, MessageCircle, PawPrint, Scale } from 'lucide-react';
import { MoneyDisplay } from '../money-display/MoneyDisplay';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

const meta = {
  title: 'Domain/ProductCard',
  component: ProductCard,
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <ul className="grid max-w-md grid-cols-2 gap-3">
        <li>
          <Story />
        </li>
      </ul>
    ),
  ],
  args: {
    nameLink: <a href="#goat-meat">Goat meat, 15 kg pack</a>,
    photo: null,
    photoLabel: 'Goat meat, 15 kg pack',
    placeholderIcon: Beef,
    tone: 'clay',
    photoSizes: '50vw',
    price: (
      <>
        <MoneyDisplay pesewas={2600} strong /> <span className="text-fg-muted">per kg</span>
      </>
    ),
    unitLine: 'A pack, about 15.000 kg',
    availability: { tone: 'good', label: 'In stock' },
  },
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A weighed product: the note says how it is charged, before anyone opens it. */
export const Weighed: Story = {
  args: { note: { icon: Scale, text: 'Priced by weight: you pay for what the pack weighs' } },
};

/** A crate at a fixed price: no note, the price is the price. */
export const FixedPrice: Story = {
  args: {
    nameLink: <a href="#eggs">Eggs, big, crate of 30</a>,
    photoLabel: 'Eggs, big, crate of 30',
    placeholderIcon: Egg,
    tone: 'sand',
    price: (
      <>
        <MoneyDisplay pesewas={6000} strong /> <span className="text-fg-muted">a crate</span>
      </>
    ),
    unitLine: undefined,
    availability: { tone: 'warning', label: 'Only a few left' },
  },
};

/** A live animal is sold by request: a band of prices, and the note says so. */
export const RequestToBuy: Story = {
  args: {
    nameLink: <a href="#goat">Goat</a>,
    photoLabel: 'Goat',
    placeholderIcon: PawPrint,
    tone: 'good',
    price: (
      <>
        <MoneyDisplay pesewas={12000} strong /> to <MoneyDisplay pesewas={195000} strong />{' '}
        <span className="text-fg-muted">a head</span>
      </>
    ),
    unitLine: undefined,
    availability: { tone: 'info', label: 'By request' },
    note: { icon: MessageCircle, text: 'Chosen with you: ask for a quote' },
  },
};

/** Out of stock still shows the price, and says it in words. */
export const OutOfStock: Story = {
  args: {
    nameLink: <a href="#broiler">Broiler chicken</a>,
    photoLabel: 'Broiler chicken',
    placeholderIcon: Bird,
    tone: 'accent',
    unitLine: undefined,
    price: (
      <>
        <MoneyDisplay pesewas={17000} strong /> <span className="text-fg-muted">a head</span>
      </>
    ),
    availability: { tone: 'slate', label: 'Out of stock' },
  },
};

/** A photograph that does not load: the tile stays, never a broken image. */
export const PhotoFailed: Story = {
  args: {
    photo: {
      alt: 'Goat meat pack',
      variants: [
        {
          variant: 'card',
          url: 'https://media.invalid/card.webp',
          width: 640,
          height: 640,
          fallbackUrl: 'https://media.invalid/card.jpg',
        },
      ],
    },
  },
};

/** While a listing loads. The grid announces it once. */
export const Loading: Story = {
  render: () => <ProductCardSkeleton />,
};
