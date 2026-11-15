import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { PhotoInput, type PhotoValue } from './PhotoInput';

const LABELS = {
  chooseLabel: 'Take or choose a photo',
  replaceLabel: 'Take another',
  removeLabel: 'Remove the photo',
  busyLabel: 'Sending the photo',
  previewAlt: 'The photograph you took',
} as const;

/** A stand-in picture for the preview, drawn in grey. */
const PICTURE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgMTIwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjEyMCIgZmlsbD0ic2lsdmVyIi8+PGNpcmNsZSBjeD0iODAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9ImdyYXkiLz48L3N2Zz4=';
const TAKEN: PhotoValue = { fileId: '019a7ac0-3066-7b9a-a0d2-c277b5d73b55', previewUrl: PICTURE };
const never = () => new Promise<string>(() => undefined);
const noop = () => undefined;

const meta = {
  title: 'Primitives/PhotoInput',
  component: PhotoInput,
} satisfies Meta<typeof PhotoInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const args = { ...LABELS, value: null, onChange: noop, upload: never };

/** Default: no photograph yet. On a phone the button opens the rear camera. */
export const Default: Story = {
  args,
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Photograph" hint="The animal where it was found, with its tag in view.">
        <PhotoInput {...LABELS} value={null} onChange={noop} upload={never} />
      </Field>
    </div>
  ),
};

/** Focus, forced on the input, shown on the button face it sits over. */
export const Focus: Story = {
  args,
  parameters: { matrix: true, pseudo: { focusVisible: ['input[type="file"]'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Photograph">
        <PhotoInput {...LABELS} value={null} onChange={noop} upload={never} />
      </Field>
    </div>
  ),
};

/** Taken: the preview with words, and the photograph can be retaken or removed. */
export const Taken: Story = {
  args,
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Photograph">
        <PhotoInput {...LABELS} value={TAKEN} onChange={noop} upload={never} />
      </Field>
    </div>
  ),
};

/** Invalid: the upload failed or the photograph is required; the error is words on the Field. */
export const Invalid: Story = {
  args,
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field
        label="Photograph"
        required
        requiredLabel="Required"
        error="The photo was not sent: the connection dropped. Take it again."
      >
        <PhotoInput {...LABELS} value={null} onChange={noop} upload={never} />
      </Field>
    </div>
  ),
};

/** Disabled: the input is out of the tab order and the face is recessed. */
export const Disabled: Story = {
  args,
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Photograph" hint="Choose the animal first.">
        <PhotoInput {...LABELS} value={null} onChange={noop} upload={never} disabled />
      </Field>
    </div>
  ),
};

function Choosing({ upload }: { upload: (file: File) => Promise<string> }) {
  const [value, setValue] = useState<PhotoValue | null>(null);
  return (
    <div className="max-w-sm">
      <Field label="Photograph">
        <PhotoInput {...LABELS} value={value} onChange={setValue} upload={upload} />
      </Field>
    </div>
  );
}

/** Busy: the picture is being shrunk and sent; it says so, and the input waits. */
export const Busy: Story = {
  args,
  render: () => <Choosing upload={never} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'pen.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(canvas.getByLabelText('Photograph'), file);
    await expect(await canvas.findByRole('status')).toHaveTextContent('Sending the photo');
  },
};

/** Keyboard path: Tab reaches the file input itself, which Enter or Space opens. */
export const KeyboardPath: Story = {
  args,
  render: () => <Choosing upload={async () => TAKEN.fileId} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByLabelText('Photograph')).toHaveFocus();
  },
};
