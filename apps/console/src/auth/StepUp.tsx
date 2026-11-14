import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ApiError } from '@hakorem/api-client';
import { Dialog, Form, FormField, FormSubmitButton, Input, type FailureLike } from '@hakorem/ui';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { useAuth } from './AuthProvider';

/** The server's answer when an operation needs a TOTP code from the last five minutes (API.md 3.4). */
export const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED';

export function isStepUpRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === STEP_UP_REQUIRED;
}

/**
 * A mutation's error as the screen should show it. A 403 `STEP_UP_REQUIRED` is not a failure to show: the
 * step-up dialog is already asking for the code, and the write is repeated once it is given. Without this,
 * `MutationFailure` would read the 403 as "permission denied".
 */
export function shownFailure<E extends FailureLike>(error: E | null): E | null {
  return isStepUpRequired(error) ? null : error;
}

export interface StepUp {
  /**
   * Runs a write. If the server answers 403 `STEP_UP_REQUIRED`, the dialog asks for a code, the session
   * steps up, and the same write runs again: the caller's `attempt` reuses its idempotency key, so the
   * repeat is the same intent (API.md 3.4, DATA_CONVENTIONS). Resolves with the write's answer, or with
   * `null` if the person cancelled the code. Any other failure rejects, as the write itself would.
   */
  run: <T>(attempt: () => Promise<T>) => Promise<T | null>;
  /** Render once, anywhere in the screen. */
  dialog: ReactNode;
}

interface Held {
  retry: () => void;
  cancel: () => void;
}

/**
 * Step-up for the writes the contract marks "Requires step-up": creating a user, resetting a password,
 * creating or changing a role, adding or revoking a grant (FR-IAM-007, FR-IAM-022). Built from Dialog and
 * the form system; it holds no state beyond the one write waiting for its code.
 */
export function useStepUp(): StepUp {
  const [held, setHeld] = useState<Held | null>(null);

  const run = useCallback(
    <T,>(attempt: () => Promise<T>): Promise<T | null> =>
      new Promise<T | null>((resolve, reject) => {
        const go = () => {
          attempt().then(resolve, (error: unknown) => {
            if (!isStepUpRequired(error)) {
              reject(error);
              return;
            }
            setHeld({
              retry: () => {
                setHeld(null);
                go();
              },
              cancel: () => {
                setHeld(null);
                resolve(null);
              },
            });
          });
        };
        go();
      }),
    [],
  );

  const dialog = (
    <StepUpDialog
      open={held !== null}
      onVerified={() => held?.retry()}
      onCancel={() => held?.cancel()}
    />
  );
  return { run, dialog };
}

const SIX_DIGITS = /^\d{6}$/;

function StepUpDialog({
  open,
  onVerified,
  onCancel,
}: {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('common');
  const auth = useAuth();
  const schema = useMemo(
    () => z.object({ code: z.string().trim().regex(SIX_DIGITS, t('stepUp.invalid')) }),
    [t],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: '' } });
  const toFailure = useWriteFailure(form);
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  const close = () => {
    form.reset({ code: '' });
    setFailure(null);
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t('stepUp.title')}
      description={t('stepUp.body')}
      closeLabel={t('actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async ({ code }) => {
          setFailure(null);
          await auth.stepUp(code);
          form.reset({ code: '' });
          onVerified();
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('stepUp.failed')} />
        <FormField
          name="code"
          label={t('stepUp.code')}
          hint={t('stepUp.codeHint')}
          required
          requiredLabel={t('field.required')}
        >
          {(field) => (
            <Input {...field} autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
          )}
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <FormSubmitButton loadingLabel={t('stepUp.confirm')}>
            {t('stepUp.confirm')}
          </FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}
