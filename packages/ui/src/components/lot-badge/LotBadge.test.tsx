import { render, screen } from '@testing-library/react';
import { CircleCheck, Clock } from 'lucide-react';
import { LotBadge } from './LotBadge';

describe('LotBadge', () => {
  it('shows the batch number alone when there is no expiry state', () => {
    const { container } = render(<LotBadge batchNo="LOT-2026-0412" />);
    expect(screen.getByText('LOT-2026-0412')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="status-badge"]')).toBeNull();
  });

  it('shows the expiry state the screen passes in, in words', () => {
    const { container } = render(
      <LotBadge
        batchNo="LOT-2026-0412"
        expiry={{ label: 'Expires in 3 days', tone: 'clay', icon: Clock }}
      />,
    );
    expect(screen.getByText('Expires in 3 days')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="status-badge"]')).toHaveAttribute(
      'data-tone',
      'clay',
    );
  });

  it('decides nothing itself: it renders whatever state it is given', () => {
    render(
      <LotBadge batchNo="LOT-1" expiry={{ label: 'Fresh', tone: 'good', icon: CircleCheck }} />,
    );
    expect(screen.getByText('Fresh')).toBeInTheDocument();
  });

  it('throws on a blank batch number', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<LotBadge batchNo="  " />)).toThrow(/batchNo/);
    quiet.mockRestore();
  });
});
