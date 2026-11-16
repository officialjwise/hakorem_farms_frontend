import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../field/Field';
import { PhotoInput, type PhotoValue } from './PhotoInput';
import { fitWithin, jpegName } from './resize';

const LABELS = {
  chooseLabel: 'Take or choose a photo',
  replaceLabel: 'Take another',
  removeLabel: 'Remove the photo',
  busyLabel: 'Sending the photo',
  previewAlt: 'The photograph you took',
} as const;

const photo = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'pen.jpg', { type: 'image/jpeg' });

function Harness({
  upload,
  onUploadError,
  error,
}: {
  upload: (file: File) => Promise<string>;
  onUploadError?: (error: unknown) => void;
  error?: string;
}) {
  const [value, setValue] = useState<PhotoValue | null>(null);
  return (
    <>
      <Field label="Photograph" hint="Of the animal where it was found" error={error}>
        <PhotoInput
          {...LABELS}
          value={value}
          onChange={setValue}
          upload={upload}
          onUploadError={onUploadError}
        />
      </Field>
      <span data-testid="file-id">{value?.fileId ?? ''}</span>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PhotoInput', () => {
  it('is the native file input, named by its Field, opening the rear camera on a phone', () => {
    render(<Harness upload={async () => 'f1'} />);
    const input = screen.getByLabelText('Photograph');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
    expect(input).toHaveAccessibleDescription('Of the animal where it was found');
    expect(screen.getByText('Take or choose a photo')).toBeInTheDocument();
  });

  it('keyboard: Tab reaches the input itself', async () => {
    render(<Harness upload={async () => 'f1'} />);
    await userEvent.tab();
    expect(screen.getByLabelText('Photograph')).toHaveFocus();
  });

  it('uploads the chosen picture, then shows it with words and offers another or removal', async () => {
    const upload = vi.fn(async () => 'file-1');
    render(<Harness upload={upload} />);
    await userEvent.upload(screen.getByLabelText('Photograph'), photo());
    expect(await screen.findByRole('img', { name: 'The photograph you took' })).toHaveAttribute(
      'src',
      'blob:preview',
    );
    expect(screen.getByTestId('file-id')).toHaveTextContent('file-1');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Take another')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove the photo' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('file-id')).toHaveTextContent('');
  });

  it('busy: says it is sending, and the input cannot be used until the server answers', async () => {
    let finish: (id: string) => void = () => undefined;
    render(<Harness upload={() => new Promise((resolve) => (finish = resolve))} />);
    await userEvent.upload(screen.getByLabelText('Photograph'), photo());
    expect(await screen.findByRole('status')).toHaveTextContent('Sending the photo');
    expect(screen.getByLabelText('Photograph')).toBeDisabled();
    finish('file-2');
    await waitFor(() => expect(screen.getByLabelText('Photograph')).toBeEnabled());
  });

  it('failed: hands the failure to the app, which shows it as the Field error, invalid in words', async () => {
    const failure = new Error('offline');
    const onUploadError = vi.fn();
    const { rerender } = render(
      <Harness upload={async () => Promise.reject(failure)} onUploadError={onUploadError} />,
    );
    await userEvent.upload(screen.getByLabelText('Photograph'), photo());
    await waitFor(() => expect(onUploadError).toHaveBeenCalledWith(failure));
    rerender(
      <Harness
        upload={async () => Promise.reject(failure)}
        onUploadError={onUploadError}
        error="The photo was not sent. Try again."
      />,
    );
    const input = screen.getByLabelText('Photograph');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/The photo was not sent/);
  });

  it('throws without a label or with a blank state word', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <PhotoInput {...LABELS} value={null} onChange={() => undefined} upload={async () => 'x'} />,
      ),
    ).toThrow(/no label/);
    const blank: string = ' ';
    expect(() =>
      render(
        <Field label="Photograph">
          <PhotoInput
            {...LABELS}
            busyLabel={blank}
            value={null}
            onChange={() => undefined}
            upload={async () => 'x'}
          />
        </Field>,
      ),
    ).toThrow(/busyLabel/);
    spy.mockRestore();
  });
});

describe('resizing before upload', () => {
  it('fits the longest edge within the limit, keeping the shape, in whole pixels', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 3, 100)).toEqual({ width: 100, height: 1 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('names the resized picture as a JPEG', () => {
    expect(jpegName('IMG_2031.HEIC')).toBe('IMG_2031.jpg');
    expect(jpegName('pen')).toBe('pen.jpg');
    expect(jpegName('.png')).toBe('.png.jpg');
  });
});
