import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MutationFailure, type QueryBoundaryLabels } from './QueryBoundary';

const labels: QueryBoundaryLabels = {
  loading: 'Saving',
  emptyTitle: 'Unused',
  errorTitle: 'The adjustment was not saved',
  errorDescription: 'Check the connection. Nothing was changed. Try again.',
  retry: 'Try again',
  reference: 'Quote this reference to support:',
  referenceCopy: { copy: 'Copy the full reference', copied: 'Copied', failed: 'Could not copy' },
  deniedTitle: 'You cannot adjust stock',
  deniedDescription: 'Ask the owner to add the stock adjustment permission to your role.',
};

const meta = {
  title: 'Patterns/MutationFailure',
  component: MutationFailure,
  args: { labels, error: null },
} satisfies Meta<typeof MutationFailure>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing has failed: nothing renders, and no empty alert is left in the page. */
export const NoFailure: Story = { parameters: { matrix: true } };

/** A refused business rule keeps its words, and the reference, on screen until the next attempt. */
export const Refused: Story = {
  args: {
    error: {
      status: 422,
      code: 'STOCK_UNIT_ON_HOLD',
      message: 'Goat G-0163 is under a veterinary withdrawal period until 28 November.',
      correlationId: '019a7b1d-f4de-751c-aa55-5aa0965fd37e',
    },
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent('veterinary withdrawal');
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

/** No answer: the screen's words, the reassurance that nothing changed, and a retry that reuses the key. */
export const NoConnection: Story = {
  parameters: { matrix: true },
  args: {
    error: {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'The server could not be reached.',
      correlationId: '',
    },
    onRetry: fn(),
  },
};

export const PermissionDenied: Story = {
  parameters: { matrix: true },
  args: {
    error: {
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to do this here.',
      correlationId: '019a7b1d-9811',
    },
  },
};
