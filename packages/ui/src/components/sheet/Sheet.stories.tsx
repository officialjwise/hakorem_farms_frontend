import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/Button';
import { Field } from '../field/Field';
import { Input } from '../input/Input';
import { Sheet, type SheetSide } from './Sheet';

const meta = { title: 'Primitives/Sheet' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function FilterSheet({
  side = 'end',
  busy = false,
  failed = false,
}: {
  side?: SheetSide;
  busy?: boolean;
  failed?: boolean;
}) {
  return (
    <Sheet
      side={side}
      trigger={<Button variant="secondary">Filters</Button>}
      title="Filter stock"
      description="Narrow the list by location."
      closeLabel="Close"
      footer={
        <>
          <Button variant="ghost">Clear</Button>
          <Button loading={busy} loadingLabel="Applying filters">
            Apply
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Location">
          <Input defaultValue="Cold room" />
        </Field>
        {failed ? (
          <p role="alert" className="text-control-md font-medium text-critical-fg">
            Filters could not be applied. The list below is unchanged. Try again.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

async function openSheet(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Filters' }));
  return within(document.body).findByRole('dialog', { name: 'Filter stock' });
}

/** Closed: only the trigger is on the page. */
export const Closed: Story = {
  parameters: { matrix: true },
  render: () => <FilterSheet />,
};

/** Open from the end edge. Axe runs on the open state. */
export const Open: Story = {
  render: () => <FilterSheet />,
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(sheet).toHaveAttribute('data-side', 'end');
    await expect(sheet).toHaveAccessibleDescription('Narrow the list by location.');
  },
};

/** Busy: the apply button is loading. */
export const Busy: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <FilterSheet side="start" busy />,
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(within(sheet).getByRole('button', { name: 'Applying filters' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  },
};

/** Failed: the failure stays inside the sheet as words, never only a toast (ADR 0006). */
export const Failed: Story = {
  globals: { theme: 'dark', density: 'comfortable' },
  render: () => <FilterSheet side="bottom" failed />,
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(within(sheet).getByRole('alert')).toHaveTextContent(/could not be applied/);
  },
};

/** At 360px a start or end sheet takes the full width and stays inside the viewport. */
export const At360px: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <FilterSheet side="start" />,
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const box = sheet.getBoundingClientRect();
    await expect(box.left).toBeGreaterThanOrEqual(0);
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
  },
};

/** Keyboard path: Tab to the trigger, Enter opens, focus moves in, Escape closes and focus returns. */
export const KeyboardPath: Story = {
  render: () => <FilterSheet />,
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const trigger = within(canvasElement).getByRole('button', { name: 'Filters' });
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const sheet = await within(document.body).findByRole('dialog', { name: 'Filter stock' });
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
