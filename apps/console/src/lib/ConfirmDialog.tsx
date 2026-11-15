import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, MutationFailure, type FailureLike } from '@hakorem/ui';
import { useStateLabels } from './states';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in words. */
  body: string;
  /** The exact quantities or amounts the write will post, shown before it is sent. */
  children?: ReactNode;
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
 * stock gets a confirmation step showing the exact amounts first"). The screen keeps one idempotency key
 * per opening, so confirming again after a failure repeats the same intent.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  children,
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      closeLabel={t('actions.cancel')}
    >
      <div className="grid gap-3 pb-2">
        {children}
        <MutationFailure error={error} labels={labels} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={pending}
            loadingLabel={pendingLabel}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
