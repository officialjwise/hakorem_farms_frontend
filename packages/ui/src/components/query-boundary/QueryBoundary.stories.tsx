import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  QueryBoundary,
  type FailureLike,
  type QueryBoundaryLabels,
  type QueryLike,
} from './QueryBoundary';

const labels: QueryBoundaryLabels = {
  loading: 'Loading products',
  emptyTitle: 'No products yet',
  emptyDescription: 'Add the first product to start selling.',
  errorTitle: 'Products could not be loaded',
  errorDescription: 'Check the connection and try again.',
  retry: 'Try again',
  reference: 'Quote this reference to support:',
  deniedTitle: 'You do not have access to products',
  deniedDescription: 'Ask the owner to add the product permission to your role.',
};

const failure = (status: number, code: string, message: string, correlationId: string) => ({
  status,
  code,
  message,
  correlationId,
});

const pending: QueryLike<string[]> = {
  status: 'pending',
  data: undefined,
  error: null,
  refetch: fn(),
};
const ready = (data: string[]): QueryLike<string[]> => ({
  status: 'success',
  data,
  error: null,
  refetch: fn(),
});
const failed = (error: FailureLike): QueryLike<string[]> => ({
  status: 'error',
  data: undefined,
  error,
  refetch: fn(),
});

const meta = {
  title: 'Patterns/QueryBoundary',
  component: QueryBoundary<string[]>,
  args: {
    labels,
    isEmpty: (data: string[]) => data.length === 0,
    query: ready(['Goat', 'Broiler chicken']),
    children: (data: string[]) => (
      <ul>
        {data.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    ),
  },
} satisfies Meta<typeof QueryBoundary<string[]>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Data is on screen: the happy path is the screen's own markup. */
export const Ready: Story = { parameters: { matrix: true } };

/** One announcement, then a placeholder with the same rough shape as the content. */
export const Loading: Story = { parameters: { matrix: true }, args: { query: pending } };

/** Why it is empty and what to do next. Not an error: no alert role. */
export const Empty: Story = {
  parameters: { matrix: true },
  args: { query: ready([]) },
};

/** The server's own safe message, the correlation id for support, and a retry. */
export const ErrorWithReference: Story = {
  args: {
    query: failed(
      failure(
        500,
        'INTERNAL',
        'Something went wrong on our side. Please quote the reference if you call us.',
        '019a7b1e-32bc-78e3-8e1c-970f89c10fed',
      ),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent('019a7b1e-32bc');
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.query.refetch).toHaveBeenCalledTimes(1);
  },
};

/** No answer at all: the screen's own words, and no reference because there is nothing to quote. */
export const ErrorNoConnection: Story = {
  parameters: { matrix: true },
  args: {
    query: failed(failure(0, 'NETWORK_ERROR', 'The server could not be reached.', '')),
  },
};

/** A 403 is permission denied, in words, on the same URL. Never a silent redirect. */
export const PermissionDenied: Story = {
  parameters: { matrix: true },
  args: {
    query: failed(
      failure(403, 'FORBIDDEN', 'You do not have permission to do this here.', '019a7b1d-9811'),
    ),
  },
};

/** A screen that already knows from the session shows denied without waiting for the server. */
export const DeniedBySession: Story = {
  parameters: { matrix: true },
  args: { denied: true, query: pending },
};

/** The retry button is reached with Tab and activated with Enter, then with Space. */
export const KeyboardPath: Story = {
  args: {
    query: failed(
      failure(500, 'INTERNAL', 'Something went wrong on our side.', '019a7b1e-32bc-78e3'),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Try again' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.query.refetch).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.query.refetch).toHaveBeenCalledTimes(2);
  },
};
