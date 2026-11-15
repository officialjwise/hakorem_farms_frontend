import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { toastLabels } from '../../test/toastLabels';
import { UIProvider } from '../ui-provider/UIProvider';
import { ConfirmChanges, type ConfirmChangesProps } from './ConfirmChanges';

function Harness(props: Partial<ConfirmChangesProps>) {
  const [open, setOpen] = useState(true);
  return (
    <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
      <ConfirmChanges
        open={open}
        onOpenChange={setOpen}
        title="Close Kasoa?"
        description="Kasoa stops trading. Its records stay."
        changes={[{ label: 'Status', before: 'Active', after: 'Closed' }]}
        changeHeadings={{ label: 'What', before: 'Now', after: 'After' }}
        consequence="A closed branch can be reopened."
        confirmLabel="Close the branch"
        cancelLabel="Cancel"
        pendingLabel="Closing"
        pending={false}
        onConfirm={() => undefined}
        {...props}
      />
    </UIProvider>
  );
}

describe('ConfirmChanges', () => {
  it('shows exactly what changes, before and after, and what cannot be taken back', async () => {
    render(<Harness />);
    const dialog = await screen.findByRole('dialog', { name: 'Close Kasoa?' });
    expect(within(dialog).getByRole('row', { name: 'Status Active Closed' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('A closed branch can be reopened.');
  });

  it('confirms once on Enter from the confirm button and keeps a failure inside', async () => {
    const onConfirm = vi.fn();
    render(
      <Harness onConfirm={onConfirm} failure={<p role="alert">Refused: last active branch</p>} />,
    );
    const dialog = await screen.findByRole('dialog');
    within(dialog).getByRole('button', { name: 'Close the branch' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('last active branch');
  });

  it('closes on Escape without confirming', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
