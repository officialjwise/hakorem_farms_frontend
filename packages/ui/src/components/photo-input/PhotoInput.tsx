'use client';

import { Camera, ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type Ref } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { Button, buttonVariants } from '../button/Button';
import { Spinner } from '../spinner/Spinner';
import { resizePhoto, type ResizeOptions } from './resize';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** A photograph that has been uploaded: the id the server gave it, and the picture to show. */
export interface PhotoValue {
  fileId: string;
  /** An object URL of the picture as it was sent, for the preview. */
  previewUrl: string;
}

export type PhotoInputProps<L extends string = string> = {
  /** From Field. */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  required?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
  value: PhotoValue | null;
  onChange: (value: PhotoValue | null) => void;
  /**
   * Sends the picture and resolves with the file id the server answers. The app passes its upload (the
   * contract's `uploadFile`, through the data layer): the component never calls the API itself.
   */
  upload: (photo: File) => Promise<string>;
  /** The upload failed: the app turns the failure into words on the Field (a persistent error). */
  onUploadError?: (error: unknown) => void;
  /** On a phone, which camera opens: the one facing away (a pen, a carcass) or the user. */
  capture?: 'environment' | 'user';
  /** How far the picture is shrunk before it leaves the device (ADR 0037). */
  resize?: ResizeOptions;
  className?: string;
  /** The button's words with no photograph yet, for example "Take or choose a photo". */
  chooseLabel: NonEmpty<L>;
  /** The button's words once there is one, for example "Take another". */
  replaceLabel: NonEmpty<L>;
  /** Removes the photograph, for example "Remove the photo". */
  removeLabel: NonEmpty<L>;
  /** While the picture is shrunk and sent, for example "Sending the photo". */
  busyLabel: NonEmpty<L>;
  /** The preview's text alternative, for example "The photograph you took". */
  previewAlt: NonEmpty<L>;
};

const LABELS = ['chooseLabel', 'replaceLabel', 'removeLabel', 'busyLabel', 'previewAlt'] as const;

/**
 * PhotoInput. Takes a photograph, shrinks it in the browser and uploads it, holding the server's file id.
 * Put it inside a Field (ADR 0005), which names it and carries its hint and error.
 *
 * The control is the native file input, so the keyboard, a screen reader and a phone's camera all treat
 * it as a file picker. It is transparent and laid over the visible button face, so a tap lands on it and
 * opens the camera directly (`capture`, `accept="image/*"`). The button face shows focus through the
 * input's focus. States: empty, busy (shrinking and sending, the input disabled), done (a preview with
 * "take another" and "remove"), and failed, which the app shows as the Field's error from
 * `onUploadError`. A failed upload keeps the previous photograph, if there was one.
 */
export function PhotoInput<L extends string>({
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  required,
  disabled = false,
  ref,
  value,
  onChange,
  upload,
  onUploadError,
  capture = 'environment',
  resize,
  className,
  ...labels
}: PhotoInputProps<L>) {
  for (const key of LABELS) {
    if ((labels[key] ?? '').trim() === '') {
      throw new Error(`PhotoInput needs a non-empty ${key}: every state has words.`);
    }
  }
  const labelled = useRequireLabel<HTMLInputElement>('PhotoInput', ref);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    // The same picture can be chosen again after a failure.
    input.value = '';
    if (picked === undefined) return;
    setBusy(true);
    try {
      const photo = await resizePhoto(picked, resize);
      const fileId = await upload(photo);
      if (!live.current) return;
      if (value !== null) URL.revokeObjectURL(value.previewUrl);
      onChange({ fileId, previewUrl: URL.createObjectURL(photo) });
    } catch (error) {
      if (live.current) onUploadError?.(error);
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const Icon = value === null ? Camera : ImageUp;
  return (
    <div data-slot="photo-input" className={cn('grid justify-items-start gap-2', className)}>
      {value === null ? null : (
        <img
          src={value.previewUrl}
          alt={labels.previewAlt}
          className="max-h-48 w-auto max-w-full rounded-md border border-border object-contain"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative inline-flex">
          <input
            ref={labelled}
            id={id}
            type="file"
            accept="image/*"
            capture={capture}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-busy={busy || undefined}
            required={required && value === null}
            disabled={disabled || busy}
            onChange={(event) => void choose(event)}
            className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              // The input is the control; this face only shows it, its focus included.
              'pointer-events-none peer-focus-visible:outline-2',
              'peer-aria-invalid:border-2 peer-aria-invalid:border-critical',
              disabled ? 'bg-surface-sunken text-fg-muted' : null,
            )}
          >
            {busy ? <Spinner decorative /> : <Icon aria-hidden="true" />}
            {busy ? labels.busyLabel : value === null ? labels.chooseLabel : labels.replaceLabel}
          </span>
        </span>
        {value === null || busy ? null : (
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              URL.revokeObjectURL(value.previewUrl);
              onChange(null);
            }}
          >
            <Trash2 aria-hidden="true" />
            {labels.removeLabel}
          </Button>
        )}
      </div>
      {busy ? (
        <p role="status" className="sr-only">
          {labels.busyLabel}
        </p>
      ) : null}
    </div>
  );
}
