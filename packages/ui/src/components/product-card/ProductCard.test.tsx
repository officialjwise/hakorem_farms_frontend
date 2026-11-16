import { fireEvent, render, screen } from '@testing-library/react';
import { Beef, Scale } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './ProductCard';

const photo = {
  alt: 'Goat meat pack',
  variants: [
    {
      variant: 'card' as const,
      url: 'https://media.example/card.webp',
      width: 640,
      height: 640,
      fallbackUrl: 'https://media.example/card.jpg',
    },
    {
      variant: 'thumb' as const,
      url: 'https://media.example/thumb.webp',
      width: 320,
      height: 320,
      fallbackUrl: 'https://media.example/thumb.jpg',
    },
  ],
};

function card(props: Partial<Parameters<typeof ProductCard>[0]> = {}) {
  return render(
    <ProductCard
      nameLink={<a href="/p/goat-meat">Goat meat, 15 kg pack</a>}
      photo={null}
      photoLabel="Goat meat, 15 kg pack"
      placeholderIcon={Beef}
      photoSizes="50vw"
      price="GH₵26.00 per kg"
      availability={{ tone: 'good', label: 'In stock' }}
      {...props}
    />,
  );
}

describe('ProductCard', () => {
  it('is one link, named by the product, with its price and availability in words', () => {
    card({ note: { icon: Scale, text: 'Priced by weight' } });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Goat meat, 15 kg pack' })).toHaveAttribute(
      'href',
      '/p/goat-meat',
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Goat meat, 15 kg pack');
    expect(screen.getByText('GH₵26.00 per kg')).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('Priced by weight')).toBeInTheDocument();
  });

  it('with no photograph, the tile is an image named by the product', () => {
    card();
    expect(screen.getByRole('img', { name: 'Goat meat, 15 kg pack' })).toBeInTheDocument();
  });

  it('a photograph offers every width in WebP and JPEG, smallest first, lazily by default', () => {
    const { container } = card({ photo });
    const img = screen.getByRole('img', { name: 'Goat meat pack' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '640');
    expect(img).toHaveAttribute(
      'srcset',
      'https://media.example/thumb.jpg 320w, https://media.example/card.jpg 640w',
    );
    expect(container.querySelector('source')).toHaveAttribute(
      'srcset',
      'https://media.example/thumb.webp 320w, https://media.example/card.webp 640w',
    );
  });

  it('the first row loads eagerly', () => {
    card({ photo, eager: true });
    expect(screen.getByRole('img', { name: 'Goat meat pack' })).toHaveAttribute('loading', 'eager');
  });

  it('a photograph that fails is removed, so the tile shows, never a broken image', () => {
    const { container } = card({ photo });
    fireEvent.error(screen.getByRole('img', { name: 'Goat meat pack' }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot="product-photo"] svg')).not.toBeNull();
  });
});
