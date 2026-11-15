import type { Meta, StoryObj } from '@storybook/react-vite';
import { Beef, Egg, PawPrint, Truck, Wheat } from 'lucide-react';
import { IconChip, type IconChipTone } from './IconChip';

const meta = {
  title: 'Data/IconChip',
  component: IconChip,
  args: { icon: PawPrint },
} satisfies Meta<typeof IconChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every tone at the three sizes, beside the words it always sits with. */
export const Tones: Story = {
  parameters: { matrix: true },
  render: () => {
    const tones: [IconChipTone, typeof Beef, string][] = [
      ['accent', PawPrint, 'Live animals'],
      ['clay', Beef, 'Meat'],
      ['sand', Egg, 'Produce and eggs'],
      ['good', Wheat, 'Feed and medication'],
      ['info', Truck, 'Suppliers'],
      ['violet', PawPrint, 'Reserved'],
      ['plum', PawPrint, 'Quarantined'],
      ['warning', PawPrint, 'Low stock'],
      ['critical', PawPrint, 'Out of stock'],
      ['slate', PawPrint, 'Other'],
    ];
    return (
      <ul className="grid gap-2">
        {tones.map(([tone, icon, words]) => (
          <li key={tone} className="flex items-center gap-3">
            <IconChip icon={icon} tone={tone} size="sm" />
            <IconChip icon={icon} tone={tone} />
            <IconChip icon={icon} tone={tone} size="lg" />
            <span>{words}</span>
          </li>
        ))}
      </ul>
    );
  },
};

/** The loading, empty, error and permission states belong to what the chip sits beside: it has none. */
export const Single: Story = {};
