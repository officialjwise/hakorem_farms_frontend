import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders its parts', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Pen 4</CardTitle>
        </CardHeader>
        <CardBody>Twelve goats</CardBody>
        <CardFooter>Updated today</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Pen 4')).toBeInTheDocument();
    expect(screen.getByText('Twelve goats')).toBeInTheDocument();
    expect(screen.getByText('Updated today')).toBeInTheDocument();
  });

  it('lets the screen choose the heading level', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h3>Pen 4</h3>
          </CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Pen 4' })).toBeInTheDocument();
  });

  it('marks a selected card by shape (edge) and by state, not colour alone', () => {
    const { container } = render(<Card selected>Pen 4</Card>);
    const card = container.firstElementChild;
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(card?.className).toContain('edge-accent');
  });

  it('becomes a link that is reachable by keyboard when interactive', async () => {
    render(
      <Card asChild interactive>
        <a href="/pens/4">Pen 4</a>
      </Card>,
    );
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Pen 4' })).toHaveFocus();
  });
});
