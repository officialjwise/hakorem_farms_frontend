import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartButton } from './CartButton';

describe('the basket button, without Button (the owner, 2026-11-18)', () => {
  it('is a button named by its words, which opens a dialog', () => {
    render(<CartButton words={{ cart: { open: 'Basket' } }} />);
    const button = screen.getByRole('button', { name: 'Basket' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
