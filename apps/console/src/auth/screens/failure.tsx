import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ErrorState, FormError, mapServerErrors, type ServerFailure } from '@hakorem/ui';
import { ApiError, NetworkError } from '../types';
import { useReferenceCopy } from '../../lib/RequestReference';

const KNOWN_CODES = [
  'INVALID_CREDENTIALS',
  'TOTP_INVALID',
  'CHALLENGE_EXPIRED',
  'PASSWORD_BREACHED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'RESET_CODE_INVALID',
  'TOTP_ALREADY_ENROLLED',
  'TOTP_ENROLMENT_REQUIRED',
  'UNSUPPORTED_LOGIN_STEP',
] as const;
type KnownCode = (typeof KNOWN_CODES)[number];

function isKnown(code: string): code is KnownCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

/** What an auth form shows when its submit rejected: `network` has no reference, an API failure always has one. */
export type AuthFailure =
  { kind: 'network' } | { kind: 'api'; failure: ServerFailure } | { kind: 'unknown' };

/**
 * Turns whatever a submit rejected with into something on screen: field errors for the details that
 * belong to a field (mapServerErrors), and a persistent failure for the rest. Messages come from the
 * catalogue by error code, falling back to the server's own safe message, never to internal detail.
 */
export function useAuthFailure<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'setError' | 'getValues'>,
) {
  const { t } = useTranslation('auth');
  return (error: unknown): AuthFailure => {
    if (error instanceof NetworkError) return { kind: 'network' };
    if (error instanceof ApiError) {
      const failure = mapServerErrors(
        {
          error: {
            code: error.code,
            message: error.message,
            correlationId: error.correlationId,
            details: error.details,
          },
        },
        form,
      );
      return {
        kind: 'api',
        failure: {
          ...failure,
          message: isKnown(error.code) ? t(`errors.${error.code}`) : error.message,
        },
      };
    }
    return { kind: 'unknown' };
  };
}

export function AuthFailureView({ failure }: { failure: AuthFailure | null }) {
  const { t } = useTranslation('auth');
  const referenceCopy = useReferenceCopy();
  if (failure === null) return null;
  if (failure.kind === 'api') {
    return (
      <FormError
        failure={failure.failure}
        title={t('errors.failureTitle')}
        referenceLabel={t('common.reference')}
        referenceCopy={referenceCopy}
      />
    );
  }
  return (
    <ErrorState
      compact
      title={t('errors.failureTitle')}
      description={failure.kind === 'network' ? t('errors.NETWORK') : t('errors.UNKNOWN')}
    />
  );
}
