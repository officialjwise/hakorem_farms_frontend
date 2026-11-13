import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown, Plus, Printer, ScanBarcode, Trash2 } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Receive stock', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const LABEL: Record<(typeof VARIANTS)[number], string> = {
  primary: 'Complete sale',
  secondary: 'Hold sale',
  ghost: 'Cancel',
  danger: 'Void sale',
};

/** Controls-driven playground. */
export const Playground: Story = {};

/** Every variant in every state. Hover, pressed and focus are forced so they can be reviewed side by side. */
export const States: Story = {
  parameters: {
    matrix: true,
    matrixLayout: 'stack',
    pseudo: {
      hover: ['.demo-hover'],
      active: ['.demo-active'],
      focusVisible: ['.demo-focus'],
    },
  },
  render: () => (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-x-3 border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-start text-xs font-semibold tracking-wide text-fg-muted uppercase">
            <th scope="col" className="text-start">
              Variant
            </th>
            {['Default', 'Hover', 'Pressed', 'Focus', 'Disabled', 'Loading'].map((s) => (
              <th key={s} scope="col" className="text-start">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VARIANTS.map((v) => (
            <tr key={v}>
              <th scope="row" className="pe-2 text-start font-semibold text-fg-muted">
                {v}
              </th>
              <td>
                <Button variant={v}>{LABEL[v]}</Button>
              </td>
              <td>
                <Button variant={v} className="demo-hover">
                  {LABEL[v]}
                </Button>
              </td>
              <td>
                <Button variant={v} className="demo-active">
                  {LABEL[v]}
                </Button>
              </td>
              <td>
                <Button variant={v} className="demo-focus">
                  {LABEL[v]}
                </Button>
              </td>
              <td>
                <Button variant={v} disabled>
                  {LABEL[v]}
                </Button>
              </td>
              <td>
                <Button variant={v} loading loadingLabel={`${LABEL[v]} in progress`}>
                  {LABEL[v]}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

/** Sizes follow density: compact is 28 / 32 / 44px, comfortable is 36 / 44 / 52px. */
export const Sizes: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="sm" iconOnly aria-label="Add item">
        <Plus />
      </Button>
      <Button size="md" iconOnly aria-label="Add item">
        <Plus />
      </Button>
      <Button size="lg" iconOnly aria-label="Add item">
        <Plus />
      </Button>
    </div>
  ),
};

/** Icons sit inside the label and are hidden from screen readers; an icon-only button must carry aria-label. */
export const WithIcons: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <ScanBarcode />
        Scan item
      </Button>
      <Button variant="secondary">
        <Printer />
        Print receipt
      </Button>
      <Button variant="ghost">
        More actions
        <ChevronDown />
      </Button>
      <Button variant="danger" iconOnly aria-label="Remove line">
        <Trash2 />
      </Button>
      <Button variant="secondary" iconOnly aria-label="Print receipt">
        <Printer />
      </Button>
    </div>
  ),
};

/** Full width, as used for the tender button at the bottom of the POS sale panel. */
export const FullWidth: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Button size="lg" fullWidth>
        Take payment: GHS 1,450.00
      </Button>
    </div>
  ),
};

/** A link that looks like a button. Navigation stays a link for assistive technology. */
export const AsLink: Story = {
  parameters: { matrix: true },
  render: () => (
    <Button asChild variant="secondary">
      <a href="#stock">View stock on hand</a>
    </Button>
  ),
};

/** Proves the submit-once guarantee: a loading button swallows repeated clicks. */
export const LoadingIgnoresClicks: Story = {
  args: { loading: true, loadingLabel: 'Saving sale', children: 'Save sale' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Saving sale' });
    await userEvent.click(button);
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
  },
};

/** The keyboard path: Tab reaches the button, Enter and Space both activate it, a disabled button is skipped. */
export const KeyboardPath: Story = {
  render: (args) => (
    <div className="flex gap-3">
      <Button onClick={args.onClick} disabled>
        Void sale
      </Button>
      <Button onClick={args.onClick}>Complete sale</Button>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Complete sale' });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
