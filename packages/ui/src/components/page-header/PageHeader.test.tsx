import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('has one h1, when the figures were generated, a refresh and the actions', async () => {
    const onRefresh = vi.fn();
    render(
      <PageHeader
        title="Dashboard"
        generatedAt="Generated 14:05, Accra time"
        refresh={{ label: 'Refresh', onRefresh, refreshing: false, refreshingLabel: 'Refreshing' }}
        actions={<button type="button">Export</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Generated 14:05, Accra time')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('says it is refreshing while it is', () => {
    render(
      <PageHeader
        title="Dashboard"
        refresh={{
          label: 'Refresh',
          onRefresh: () => undefined,
          refreshing: true,
          refreshingLabel: 'Refreshing',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Refreshing' })).toHaveAttribute('aria-busy', 'true');
  });
});
