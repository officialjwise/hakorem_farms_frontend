import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressList } from './ProgressList';

const ITEMS = [
  { id: 'a', label: 'Live goats', value: 120, formatted: '120 head', href: '/stock?category=a' },
  { id: 'b', label: 'Eggs', value: 60, formatted: '60 crates' },
];

describe('ProgressList', () => {
  it('names each row and its figure in words, the longest bar full', () => {
    const { container } = render(<ProgressList label="Stock by category" items={ITEMS} />);
    const list = screen.getByRole('list', { name: 'Stock by category' });
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('Eggs60 crates');
    const bars = container.querySelectorAll('[aria-hidden="true"] > span');
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe('50%');
  });

  it('makes a row with an address a link, reachable by keyboard', async () => {
    render(<ProgressList label="Stock by category" items={ITEMS} />);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Live goats' })).toHaveFocus();
  });
});
