import type { Meta, StoryObj } from '@storybook/react-vite';
import { PackagePlus } from 'lucide-react';
import { Button } from '../button/Button';
import {
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableHeader,
  TableMessageRow,
  TableRow,
} from '../table/Table';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  args: { title: 'No stock on hand' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Says what is empty, why it matters, and the one thing to do next. */
export const WithAction: Story = {
  parameters: { matrix: true },
  args: {
    description: 'Receive stock from a supplier and it will appear here.',
    icon: PackagePlus,
    action: <Button>Receive stock</Button>,
  },
};

/** When there is nothing the operator can do, the title and description are enough. */
export const WithoutAction: Story = {
  parameters: { matrix: true },
  args: { title: 'No sales yet today', description: 'Sales appear here as they are made.' },
};

/** Less room, for the inside of a card or a panel. */
export const Compact: Story = {
  parameters: { matrix: true },
  args: { title: 'No notes on this animal', compact: true },
};

/** The same markup inside a table, through TableMessageRow. */
export const InTable: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead numeric>Weight (kg)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableMessageRow
            colSpan={2}
            tone="empty"
            title="No stock on hand"
            description="Receive stock from a supplier and it will appear here."
            action={<Button size="sm">Receive stock</Button>}
          />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};
