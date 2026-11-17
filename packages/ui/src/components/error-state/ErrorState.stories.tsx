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

/**
 * A failed request leaves its correlation id on screen, so a support call starts with a reference: its last
 * eight characters, in two groups, with a button that copies all of it (owner, 2026-11-17; ADR 0051).
 */
export const WithReference: Story = {
  parameters: { matrix: true },
  args: {
    reference: '019a7b1d-f4de-751c-aa55-5aa0965fd37e',
    referenceLabel: 'Quote this reference to support:',
    referenceCopy: { copy: 'Copy the full reference', copied: 'Copied', failed: 'Could not copy' },
  },
};

/** A reference a person reads in full, such as a permission's name, is shown whole with no copy button. */
export const WithPlainReference: Story = {
  parameters: { matrix: true },
  args: { reference: 'inv.transfer.receive', referenceLabel: 'Permission needed:' },
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
