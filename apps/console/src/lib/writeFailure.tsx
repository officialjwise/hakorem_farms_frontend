import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, NetworkError } from '@hakorem/api-client';
import { Button, ErrorState, FormError, mapServerErrors, type ServerFailure } from '@hakorem/ui';
import { useReferenceCopy } from './RequestReference';

/** What a form shows when its submit was refused. `conflict` is a 409 on a versioned write. */
export type WriteFailure =
  | { kind: 'network' }
  | { kind: 'conflict'; correlationId: string }
  | { kind: 'api'; failure: ServerFailure }
  | { kind: 'unknown' };

/**
 * Turns what a form's submit rejected with into words on screen (DATA_CONVENTIONS, "Errors: one envelope").
 * Details that name a field land on that field (`mapServerErrors`); the rest stays as a persistent
 * `FormError` with its reference. A 409 means the record changed since it was opened: reload and decide.
 * The server's `message` is safe to show.
 */
export function useWriteFailure<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'setError' | 'getValues'>,
) {
  return (error: unknown): WriteFailure => {
    if (error instanceof NetworkError) return { kind: 'network' };
    if (error instanceof ApiError) {
      if (error.status === 409) return { kind: 'conflict', correlationId: error.correlationId };
      return { kind: 'api', failure: mapServerErrors(error.envelope, form) };
    }
    return { kind: 'unknown' };
  };
}

export function WriteFailureView({
  failure,
  title,
  onReload,
}: {
  failure: WriteFailure | null;
  /** What did not happen, for example "The profile was not saved". */
  title: string;
  /** For a 409: refetch the record, so the form shows the current version. */
  onReload?: () => void;
}) {
  const { t } = useTranslation('common');
  const referenceCopy = useReferenceCopy();
  if (failure === null) return null;
  switch (failure.kind) {
    case 'api':
      return (
        <FormError
          failure={failure.failure}
          title={title}
          referenceLabel={t('states.reference')}
          referenceCopy={referenceCopy}
        />
      );
    case 'conflict': {
      const action = onReload ? (
        <Button variant="secondary" onClick={onReload}>
          {t('actions.reload')}
        </Button>
      ) : undefined;
      return failure.correlationId === '' ? (
        <ErrorState
          compact
          title={t('conflict.title')}
          description={t('conflict.body')}
          action={action}
        />
      ) : (
        <ErrorState
          compact
          title={t('conflict.title')}
          description={t('conflict.body')}
          reference={failure.correlationId}
          referenceLabel={t('states.reference')}
          referenceCopy={referenceCopy}
          action={action}
        />
      );
    }
    case 'network':
    case 'unknown':
      return <ErrorState compact title={title} description={t('states.errorBody')} />;
  }
}
