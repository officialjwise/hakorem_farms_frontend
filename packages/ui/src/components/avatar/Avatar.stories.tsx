import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar,
  args: { name: 'Ama Mensah' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A one-pixel image that loads at once, so the photo path renders without a network. */
const LOADED_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const Image: Story = {
  parameters: { matrix: true },
  args: { src: LOADED_IMAGE },
};

/** No photo: up to two initials. */
export const Fallback: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Ama Mensah" size="sm" />
      <Avatar name="Kofi Boateng" size="md" />
      <Avatar name="Efua" size="lg" />
    </div>
  ),
};

/** While the photo is on its way the initials hold the place, so nothing jumps. */
export const Loading: Story = {
  parameters: { matrix: true },
  args: { name: 'Yaw Owusu', src: 'https://images.invalid/yaw.jpg' },
};

/** A photo that fails to load falls back to initials. */
export const Broken: Story = {
  parameters: { matrix: true },
  args: { name: 'Akosua Darko', src: '/missing-photo.jpg' },
};
