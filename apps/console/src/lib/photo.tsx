import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, NetworkError, newIdempotencyKey, type components } from '@hakorem/api-client';
import { Field, PhotoInput, type PhotoValue } from '@hakorem/ui';
import { useApiMutation } from '../data/api';

type FilePurpose = components['schemas']['FilePurpose'];

/**
 * The upload `PhotoInput` is given: `uploadFile` with the purpose, multipart through the generated client
 * (ADR 0037), answering the stored file's id. Each picture is its own intent with its own key; an automatic
 * retry of the same picture reuses it.
 */
export function usePhotoUpload(purpose: FilePurpose) {
  const upload = useApiMutation('uploadFile');
  return (file: File) =>
    upload
      .mutateAsync({ body: { file, purpose } }, { idempotencyKey: newIdempotencyKey() })
      .then((stored) => stored.id);
}

/**
 * A photograph as evidence, in a Field: camera first on a phone, shrunk before it is sent, and a failed
 * upload left on the field in words (the refusal's, ADR 0038, or the connection's).
 */
export function EvidencePhotoField({
  label,
  hint,
  value,
  onChange,
  required = false,
  missing = false,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: PhotoValue | null;
  onChange: (value: PhotoValue | null) => void;
  required?: boolean;
  /** The form was sent without the photograph it needs. */
  missing?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation('common');
  const upload = usePhotoUpload('EVIDENCE');
  const [failure, setFailure] = useState<string | null>(null);
  const error =
    failure ?? (missing && value === null ? t('photo.missing') : undefined) ?? undefined;
  const requiredProps = required
    ? { required: true as const, requiredLabel: t('field.required') }
    : { required: false as const };
  return (
    <Field label={label} hint={hint} error={error} {...requiredProps}>
      <PhotoInput
        value={value}
        onChange={(next) => {
          setFailure(null);
          onChange(next);
        }}
        upload={upload}
        onUploadError={(problem) =>
          setFailure(
            problem instanceof NetworkError
              ? t('photo.offline')
              : problem instanceof ApiError
                ? problem.message
                : t('photo.failed'),
          )
        }
        disabled={disabled}
        chooseLabel={t('photo.choose')}
        replaceLabel={t('photo.replace')}
        removeLabel={t('photo.remove')}
        busyLabel={t('photo.busy')}
        previewAlt={t('photo.preview')}
      />
    </Field>
  );
}
