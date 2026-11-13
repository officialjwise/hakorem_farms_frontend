import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

function Example({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue="details" onValueChange={onValueChange}>
      <TabsList aria-label="Animal record">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="weights">Weights</TabsTrigger>
        <TabsTrigger value="health" disabled>
          Health
        </TabsTrigger>
        <TabsTrigger value="costs">Costs</TabsTrigger>
      </TabsList>
      <TabsContent value="details">Details panel</TabsContent>
      <TabsContent value="weights">Weights panel</TabsContent>
      <TabsContent value="costs">Costs panel</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('names the tab list and selects the default tab', () => {
    render(<Example />);
    expect(screen.getByRole('tablist', { name: 'Animal record' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Details panel')).toBeVisible();
  });

  it('moves with the arrow keys, skipping a disabled tab, and Home and End', async () => {
    render(<Example />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Weights' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Costs' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Costs' })).toHaveFocus();
  });

  it('selects on activation and reports it', async () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Weights' }));
    expect(onValueChange).toHaveBeenCalledWith('weights');
    expect(screen.getByText('Weights panel')).toBeVisible();
  });

  it('does not select a disabled tab', async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole('tab', { name: 'Health' }));
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });
});
