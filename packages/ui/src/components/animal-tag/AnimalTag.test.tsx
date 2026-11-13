import { render, screen } from '@testing-library/react';
import { Goal } from 'lucide-react';
import { AnimalTag } from './AnimalTag';

describe('AnimalTag', () => {
  it('shows the tag number and species', () => {
    render(<AnimalTag tagNo="GT-0142" speciesLabel="Goat" icon={Goal} />);
    expect(screen.getByText('GT-0142')).toBeInTheDocument();
    expect(screen.getByText('Goat')).toBeInTheDocument();
  });

  it('reads the tag and species as separate words', () => {
    const { container } = render(<AnimalTag tagNo="GT-0142" speciesLabel="Goat" />);
    expect(container.textContent).toBe('GT-0142 Goat');
  });

  it('keeps the full text when long: truncation is visual only', () => {
    const long = 'GT-0142-WEST-PADDOCK-BREEDING-LINE-0007';
    render(<AnimalTag tagNo={long} />);
    expect(screen.getByText(long)).toHaveClass('truncate');
  });

  it('hides the icon from assistive technology', () => {
    const { container } = render(<AnimalTag tagNo="GT-0142" icon={Goal} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is not interactive', () => {
    render(<AnimalTag tagNo="GT-0142" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('throws on a blank tag', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<AnimalTag tagNo="  " />)).toThrow(/tagNo/);
    quiet.mockRestore();
  });
});
