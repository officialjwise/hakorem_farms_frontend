import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, MessageSquareText } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Dialog,
  DialogActions,
  Form,
  FormField,
  FormSubmitButton,
  MutationFailure,
  Textarea,
  type FailureLike,
  type QueryBoundaryLabels,
} from '@hakorem/ui';

/** `ReasonRequest.reason` in the contract: required, at most 500 characters. */
export const REASON_MAX_LENGTH = 500;

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in words, naming the person or device. */
  body: string;
  /** Extra words under the body, for example "this is your own device". */
  warning?: ReactNode;
  submitLabel: string;
  /** Resolves when the write succeeded; rejects with its failure, which stays on screen. */
  onConfirm: (reason: string) => Promise<void>;
  /** The write's failure, already filtered for step-up (`shownFailure`). */
  error: FailureLike | null;
  failureLabels: Pick<
    QueryBoundaryLabels,
    'errorTitle' | 'errorDescription' | 'retry' | 'reference' | 'deniedTitle' | 'deniedDescription'
  >;
  destructive?: boolean;
}

/**
 * A confirmation that asks why, for the writes whose body is the contract's `ReasonRequest`: disabling,
 * enabling or unlocking an account, resetting a password, revoking a grant or a session. The reason goes to
 * the audit log. A failure stays in the dialog as a `MutationFailure`, and submitting again repeats the same
 * intent: the screen keeps one idempotency key per opening of the dialog (DATA_CONVENTIONS).
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  body,
  warning,
  submitLabel,
  onConfirm,
  error,
  failureLabels,
  destructive = false,
}: ReasonDialogProps) {
  const { t } = useTranslation(['iam', 'common']);
  const schema = useMemo(
    () =>
      z.object({
        reason: z.string().trim().min(1, t('iam:user.reasonRequired')).max(REASON_MAX_LENGTH),
      }),
    [t],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { reason: '' } });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ reason: '' });
        onOpenChange(next);
      }}
      title={title}
      description={body}
      closeLabel={t('common:actions.cancel')}
      icon={MessageSquareText}
      iconTone={destructive ? 'critical' : 'accent'}
      requiredNote={t('common:field.requiredNote')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async ({ reason }) => {
          await onConfirm(reason);
          form.reset({ reason: '' });
        }}
        // The failure is the mutation's own and stays on screen through `error`.
        onSubmitError={() => undefined}
      >
        {warning}
        <MutationFailure error={error} labels={failureLabels} />
        <FormField
          name="reason"
          label={t('iam:user.reason')}
          hint={t('iam:user.reasonHint')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
        >
          {(field) => <Textarea {...field} maxLength={REASON_MAX_LENGTH} rows={2} />}
        </FormField>
        <DialogActions
          cancelLabel={t('common:actions.cancel')}
          onCancel={() => onOpenChange(false)}
        >
          <FormSubmitButton variant={destructive ? 'danger' : 'primary'} loadingLabel={submitLabel}>
            <CircleCheck aria-hidden="true" />
            {submitLabel}
          </FormSubmitButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
