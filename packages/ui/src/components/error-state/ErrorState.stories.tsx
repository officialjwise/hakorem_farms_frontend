import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lock } from 'lucide-react';
import { Button } from '../button/Button';
import { ErrorState } from './ErrorState';

const meta = {
  title: 'Primitives/ErrorState',
  component: ErrorState,
  args: {
    title: 'Stock on hand could not be loaded',
    description: 'Check the connection and try again.',
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { matrix: true } };

/** A failed request leaves its correlation id on screen, so a support call starts with a reference. */
export const WithReference: Story = {
  parameters: { matrix: true },
  args: { reference: '3f2a9c1e-7b24-4d0e-9a51-0c6d2e8f41b7', referenceLabel: 'Reference:' },
};

export const WithRetry: Story = {
  parameters: { matrix: true },
  args: { action: <Button variant="secondary">Try again</Button> },
};

/** Permission denied is an ErrorState with a lock: a screen never redirects silently. */
export const PermissionDenied: Story = {
  parameters: { matrix: true },
  args: {
    icon: Lock,
    title: 'You do not have access to stock valuation',
    description: 'Ask the owner to add the stock valuation permission to your role.',
  },
};
