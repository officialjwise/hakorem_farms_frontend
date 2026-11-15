import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmChanges, MutationFailure, type ChangeRow, type FailureLike } from '@hakorem/ui';
import { useStateLabels } from './states';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in words. */
  body: string;
  /** Exactly what changes, before and after, with its amounts (F5b). */
  changes?: readonly ChangeRow[];
  /** The exact quantities or amounts the write will post, shown before it is sent. */
  children?: ReactNode;
  /** What cannot be taken back. */
  consequence?: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  /** The write's failure. It stays in the dialog, in words, with its reference. */
  error: FailureLike | null;
  /** What did not happen, for the failure's title. */
  failedTitle: string;
  destructive?: boolean;
}

/**
 * The confirmation every write to stock or money opens first (BUILD_PROMPT: "Anything that writes money or
 * stock gets a confirmation step showing the exact amounts first"), drawn by `ConfirmChanges` (ADR 0033).
 * The screen keeps one idempotency key per opening, so confirming again after a failure repeats the same
 * intent. A refusal from the API, such as closing the last active branch, stays here in its own words.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  changes,
  children,
  consequence,
  confirmLabel,
  pendingLabel,
  pending,
  onConfirm,
  error,
  failedTitle,
  destructive = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const labels = useStateLabels({
    loading: pendingLabel,
    emptyTitle: failedTitle,
    errorTitle: failedTitle,
    deniedTitle: failedTitle,
  });
  return (
    <ConfirmChanges
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      changes={changes}
      changeHeadings={{
        label: t('confirm.what'),
        before: t('confirm.before'),
        after: t('confirm.after'),
      }}
      consequence={consequence}
      confirmLabel={confirmLabel}
      cancelLabel={t('actions.cancel')}
      pendingLabel={pendingLabel}
      pending={pending}
      onConfirm={onConfirm}
      failure={<MutationFailure error={error} labels={labels} />}
      tone={destructive ? 'danger' : 'default'}
    >
      {children}
    </ConfirmChanges>
  );
}
