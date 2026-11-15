import { render, screen } from '@testing-library/react';
import { Banknote } from 'lucide-react';
import { ReportTile } from './ReportTile';

describe('ReportTile', () => {
  it('reads as its label and figure; the corner and the diamond are hidden decoration', () => {
    const { container } = render(
      <ReportTile
        label="Total sales"
        value="GH₵ 9,700.00"
        detail="Total for the range"
        icon={Banknote}
      />,
    );
    expect(screen.getByText('Total sales')).toBeVisible();
    expect(screen.getByText('GH₵ 9,700.00')).toBeVisible();
    const hidden = container.firstElementChild?.querySelectorAll(':scope > [aria-hidden="true"]');
    expect(hidden?.length).toBe(2);
  });

  it('puts the icon on the solid fill with its paired text colour, never a mark token as text', () => {
    const { container } = render(<ReportTile label="Net" value="1" icon={Banknote} tone="sand" />);
    const diamond = container.firstElementChild?.querySelectorAll(
      ':scope > [aria-hidden="true"]',
    )[1];
    expect(diamond?.className).toContain('bg-warning-strong');
    expect(diamond?.className).toContain('text-warning-on');
  });
});
