import { render, screen } from '@testing-library/react';
import { CircleCheck, Hourglass } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders its label as text, with the icon hidden from assistive technology', () => {
    const { container } = render(<StatusBadge tone="good" icon={CircleCheck} label="In stock" />);
    expect(screen.getByText('In stock')).toBeVisible();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the mark token only for the icon and border, and the text token for words', () => {
    const { container } = render(<StatusBadge tone="good" icon={CircleCheck} label="Paid" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain('text-good-fg');
    expect(badge?.className).toContain('bg-good-subtle');
    expect(badge?.className).toContain('border-good');
    expect(badge?.className).not.toMatch(/(^|\s)(text|bg)-good(\s|$)/);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('stroke-good');
  });

  it('uses the strong fill and on-strong text for a strong status', () => {
    const { container } = render(
      <StatusBadge
        tone="critical"
        variant="strong"
        icon={Hourglass}
        label="Void awaiting approval"
      />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain('bg-critical-strong');
    expect(badge?.className).toContain('text-critical-on');
  });

  it('refuses to render an empty or blank label', () => {
    const blank: string = '   ';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<StatusBadge tone="warning" icon={Hourglass} label={blank} />)).toThrow(
      /non-empty label/,
    );
    spy.mockRestore();
  });
});
