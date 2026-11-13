import type { Meta, StoryObj } from '@storybook/react-vite';
import { Goal } from 'lucide-react';
import { AnimalTag } from './AnimalTag';

const meta = {
  title: 'Domain/AnimalTag',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A normal tag with its species. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => <AnimalTag tagNo="GT-0142" speciesLabel="Goat" />,
};

/** With the species icon, a second cue beside the words. */
export const WithIcon: Story = {
  parameters: { matrix: true },
  render: () => <AnimalTag tagNo="SH-0007" icon={Goal} speciesLabel="Sheep" />,
};

/** A tag with nothing else to say. */
export const Minimal: Story = {
  parameters: { matrix: true },
  render: () => <AnimalTag tagNo="PG-9" />,
};

/** The extreme: a long tag truncates visually and keeps its full text. */
export const Long: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-40">
      <AnimalTag tagNo="GT-0142-WEST-PADDOCK-BREEDING-LINE-0007" speciesLabel="Goat" />
    </div>
  ),
};
