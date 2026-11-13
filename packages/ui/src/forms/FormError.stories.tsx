import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { FormError } from './FormError';
import type { ServerFailure } from './serverErrors';

const meta = {
  title: 'Forms/FormError',
  component: FormError,
  args: { title: 'The sale was not saved', referenceLabel: 'Reference' },
} satisfies Meta<typeof FormError>;

export default meta;
type Story = StoryObj<typeof meta>;

const base: ServerFailure = {
  code: 'STOCK_HELD',
  message: 'The sale could not be completed, and nothing was charged.',
  correlationId: '0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11',
  unmapped: [],
};

/** With a reference: a support call starts from it. */
export const WithReference: Story = {
  parameters: { matrix: true },
  args: { failure: base },
};

/** With the details that did not land on a field. */
export const WithDetails: Story = {
  parameters: { matrix: true },
  args: {
    failure: {
      ...base,
      unmapped: [
        { field: null, code: 'WITHDRAWAL_HOLD', message: 'GT-0142 is under a withdrawal hold.' },
        { field: '/nickname', code: 'UNKNOWN', message: 'GT-0207 is already sold.' },
      ],
    },
  },
};

function DismissibleDemo({ title, referenceLabel }: { title: string; referenceLabel: string }) {
  const [failure, setFailure] = useState<ServerFailure | null>(base);
  return (
    <FormError
      failure={failure}
      title={title}
      referenceLabel={referenceLabel}
      onDismiss={() => setFailure(null)}
      dismissLabel="Dismiss"
    />
  );
}

/** Dismissible: it stays until the operator dismisses it or the next save succeeds. */
export const Dismissible: Story = {
  args: { failure: base },
  render: (args) => <DismissibleDemo title={args.title} referenceLabel={args.referenceLabel} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

/** Hidden: no failure, nothing on screen. */
export const Hidden: Story = {
  args: { failure: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('alert')).toBeNull();
  },
};
