import { render, screen } from '@testing-library/react';
import { Unavailable } from './Unavailable';

describe('Unavailable', () => {
  it('says the figure is unavailable and why, with no number', () => {
    const { container } = render(
      <Unavailable title="No data source yet" description="Arrives with the sales module." />,
    );
    expect(screen.getByText('No data source yet')).toBeInTheDocument();
    expect(screen.getByText('Arrives with the sales module.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });
  it('refuses a blank title', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blank: string = '';
    expect(() => render(<Unavailable title={blank} />)).toThrow(/non-empty title/);
    spy.mockRestore();
  });
});
