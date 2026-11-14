import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import { Button } from '../components/button/Button';
import { Dialog } from '../components/dialog/Dialog';
import { Input } from '../components/input/Input';
import { Form, FormSubmitButton } from './Form';
import { FormField } from './FormField';
import { useDirtyGuard } from './useDirtyGuard';

const meta = {
  title: 'Forms/useDirtyGuard',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const schema = z.object({ tagNo: z.string().min(1, 'Enter the tag number.') });
type Values = z.input<typeof schema>;

/**
 * An app's router adapter calls `requestLeave` before navigating. Here the
 * "navigation" is a button that writes where the operator would have gone, and
 * the confirm Dialog is the existing Dialog. Wiring a real router is F1's job.
 */
function Screen() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { tagNo: '' } });
  const guard = useDirtyGuard(form.formState.isDirty);
  const [where, setWhere] = useState('on the form');

  return (
    <div className="grid max-w-sm gap-4">
      <Form form={form} aria-label="Edit animal" onSubmit={() => undefined}>
        <FormField control={form.control} name="tagNo" label="Tag number">
          {(field) => <Input {...field} />}
        </FormField>
        <FormSubmitButton loadingLabel="Saving">Save</FormSubmitButton>
      </Form>
      <Button
        variant="secondary"
        onClick={() => guard.requestLeave(() => setWhere('on the stock list'))}
      >
        Back to stock
      </Button>
      <p aria-live="polite">You are {where}.</p>
      <Dialog
        open={guard.blocked}
        onOpenChange={(open) => {
          if (!open) guard.stay();
        }}
        title="Leave without saving?"
        description="The tag number you typed has not been saved."
        closeLabel="Close"
        footer={
          <>
            <Button variant="secondary" onClick={guard.stay}>
              Stay on the form
            </Button>
            <Button variant="danger" onClick={guard.confirmLeave}>
              Leave without saving
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </div>
  );
}

/** Clean: nothing typed, so leaving is immediate and no dialog opens. */
export const Clean: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Back to stock' }));
    await expect(canvas.getByText('You are on the stock list.')).toBeInTheDocument();
  },
};

/** Dirty: leaving asks first. Staying keeps the form and the typed text. */
export const Dirty: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tag number' }), 'GT-0142');
    await userEvent.click(canvas.getByRole('button', { name: 'Back to stock' }));

    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Leave without saving?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay on the form' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(canvas.getByText('You are on the form.')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Tag number' })).toHaveValue('GT-0142');
  },
};

/** Leaving confirmed: the held navigation runs. */
export const LeaveConfirmed: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tag number' }), 'GT-0142');
    await userEvent.click(canvas.getByRole('button', { name: 'Back to stock' }));
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Leave without saving?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    await expect(canvas.getByText('You are on the stock list.')).toBeInTheDocument();
  },
};

/** Saved: a successful save makes the form clean, so leaving is not blocked. */
export const SavedThenLeave: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tag number' }), 'GT-0142');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy'),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Back to stock' }));
    await expect(canvas.getByText('You are on the stock list.')).toBeInTheDocument();
    await expect(within(document.body).queryByRole('dialog')).toBeNull();
  },
};
