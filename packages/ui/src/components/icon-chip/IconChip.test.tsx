import { render } from '@testing-library/react';
import { Beef } from 'lucide-react';
import { IconChip } from './IconChip';

describe('IconChip', () => {
  it('is decorative: hidden from assistive technology, with no name of its own', () => {
    const { container } = render(<IconChip icon={Beef} />);
    const chip = container.firstElementChild;
    expect(chip).toHaveAttribute('aria-hidden', 'true');
    expect(chip).not.toHaveAttribute('aria-label');
  });

  it('wears a subtle tint and draws the icon with a mark token, never a text or fill colour', () => {
    const { container } = render(<IconChip icon={Beef} tone="clay" />);
    expect(container.firstElementChild?.className).toContain('bg-clay-subtle');
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('stroke-clay');
  });
});
