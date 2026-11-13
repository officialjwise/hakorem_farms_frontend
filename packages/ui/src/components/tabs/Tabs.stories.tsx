import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

const meta = {
  title: 'Primitives/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example({ value = 'details' }: { value?: string }) {
  return (
    <Tabs defaultValue={value}>
      <TabsList aria-label="Animal record">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="weights">Weights</TabsTrigger>
        <TabsTrigger value="health" disabled>
          Health
        </TabsTrigger>
        <TabsTrigger value="costs">Costs</TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        <p className="p-2 text-fg">Tag GT-0142, Boer cross, pen 4.</p>
      </TabsContent>
      <TabsContent value="weights">
        <p className="p-2 text-fg">Last weighed 38.400 kg.</p>
      </TabsContent>
      <TabsContent value="costs">
        <p className="p-2 text-fg">Accumulated cost GH₵412.00.</p>
      </TabsContent>
    </Tabs>
  );
}

export const Default: Story = {
  parameters: { matrix: true },
  render: () => <Example />,
};

/** The selected tab is bolder and underlined, so it is not colour alone. */
export const Selected: Story = {
  parameters: { matrix: true },
  render: () => <Example value="weights" />,
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['[role="tab"][data-state="active"]'] } },
  render: () => <Example />,
};

/** A disabled tab is skipped by the arrow keys. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => <Example />,
};

/** At 360px the tab row scrolls inside itself and the page does not. */
export const At360px: Story = {
  render: () => (
    <div className="w-[22.5rem]">
      <Example />
    </div>
  ),
};

export const KeyboardPath: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'Details' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Weights' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Costs' })).toHaveFocus();
    await expect(canvas.getByRole('tab', { name: 'Costs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};
