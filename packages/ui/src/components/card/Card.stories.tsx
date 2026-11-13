import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Skeleton } from '../skeleton/Skeleton';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from './Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const Content = () => (
  <>
    <CardHeader>
      <CardTitle asChild>
        <h3>Pen 4, goats</h3>
      </CardTitle>
    </CardHeader>
    <CardBody>Twelve animals, average 38.400 kg.</CardBody>
    <CardFooter>Last weighed today</CardFooter>
  </>
);

export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Card>
        <Content />
      </Card>
    </div>
  ),
};

/** The whole card is one link, so one tab stop and one name. */
export const Interactive: Story = {
  parameters: { matrix: true, pseudo: { hover: ['.demo-hover'], focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Card asChild interactive className="demo-hover">
        <a href="#pen-4">
          <Content />
        </a>
      </Card>
      <Card asChild interactive className="demo-focus">
        <a href="#pen-5">
          <Content />
        </a>
      </Card>
    </div>
  ),
};

/** Selected: an accent edge and tint, so selection is shape as well as colour. */
export const Selected: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Card selected>
        <Content />
      </Card>
    </div>
  ),
};

/** Loading composes Skeleton inside the card; there is no loading prop. */
export const Loading: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Card>
        <CardHeader>
          <Skeleton label="Loading pen" className="w-1/2" />
        </CardHeader>
        <CardBody>
          <div className="grid gap-2">
            <Skeleton />
            <Skeleton className="w-3/4" />
          </div>
        </CardBody>
      </Card>
    </div>
  ),
};

export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Card asChild interactive>
        <a href="#pen-4">
          <Content />
        </a>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('link', { name: /Pen 4/ })).toHaveFocus();
  },
};
