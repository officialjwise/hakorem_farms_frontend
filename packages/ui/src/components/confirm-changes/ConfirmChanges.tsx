'use client';

import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { Dialog, DialogActions } from '../dialog/Dialog';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface ChangeRow {
  /** What changes, such as "Status" or "Cold room, goat meat". */
  label: string;
  /** What it is now, already formatted. Omit for something new. */
  before?: ReactNode;
  /** What it will be, already formatted (amounts through MoneyDisplay, QuantityDisplay). */
  after: ReactNode;
}

export type ConfirmChangesProps<T extends string = string> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required. The question, such as "Post this adjustment?". */
  title: NonEmpty<T>;
  /** What will happen, in one sentence. */
  description: string;
  /** Exactly what is about to change, before and after. */
  changes?: readonly ChangeRow[];
  /** Column headings for the changes: what, now, after. */
  changeHeadings?: { label: string; before: string; after: string };
  /** Further detail the write carries, such as its lines with their quantities and values at cost. */
  children?: ReactNode;
  /** What cannot be taken back, such as "Posted stock is corrected only by a reversing entry." */
  consequence?: string;
  confirmLabel: string;
  cancelLabel: NonEmpty<string>;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  /** The write's failure, in words with its reference (MutationFailure). It stays in the dialog. */
  failure?: ReactNode;
  /** `danger` for writes that remove, close or write off. */
  tone?: 'default' | 'danger';
  /** The chip beside the title. Default: a circled alert, or a warning triangle for `danger`. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** The confirm button's icon. Default: a tick. */
  confirmIcon?: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * ConfirmChanges. The step every write to stock or money takes first: the exact change, before and after,
 * with its amounts, then a deliberate confirm. A refusal stays inside, in words, and confirming again
 * repeats the same intent (the screen keeps one idempotency key per opening).
 */
export function ConfirmChanges<T extends string>({
  open,
  onOpenChange,
  title,
  description,
  changes,
  changeHeadings,
  children,
  consequence,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  pending,
  onConfirm,
  failure,
  tone = 'default',
  icon,
  confirmIcon: ConfirmIcon = CircleCheck,
}: ConfirmChangesProps<T>) {
  const showBefore = changes?.some((row) => row.before !== undefined) ?? false;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={cancelLabel}
      icon={icon ?? (tone === 'danger' ? TriangleAlert : CircleAlert)}
      iconTone={tone === 'danger' ? 'critical' : 'accent'}
    >
      <div data-slot="confirm-changes" className="grid gap-3">
        {changes === undefined || changes.length === 0 ? null : (
          <table className="w-full text-sm">
            {changeHeadings === undefined ? null : (
              <thead>
                <tr className="border-b border-border text-fg-muted">
                  <th scope="col" className="py-1.5 pe-3 text-start font-semibold">
                    {changeHeadings.label}
                  </th>
                  {showBefore ? (
                    <th scope="col" className="py-1.5 pe-3 text-end font-semibold">
                      {changeHeadings.before}
                    </th>
                  ) : null}
                  <th scope="col" className="py-1.5 text-end font-semibold">
                    {changeHeadings.after}
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {changes.map((row) => (
                <tr key={row.label} className="border-b border-border">
                  <th scope="row" className="py-1.5 pe-3 text-start font-normal">
                    {row.label}
                  </th>
                  {showBefore ? (
                    <td className="py-1.5 pe-3 text-end text-fg-muted tabular-nums">
                      {row.before ?? null}
                    </td>
                  ) : null}
                  <td className="py-1.5 text-end font-semibold tabular-nums">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {children}
        {consequence === undefined ? null : (
          <p
            className={cn(
              'rounded-md border-s-4 px-3 py-2 text-sm',
              tone === 'danger'
                ? 'border-critical bg-critical-subtle text-critical-fg'
                : 'border-info bg-info-subtle text-info-fg',
            )}
          >
            {consequence}
          </p>
        )}
        {failure}
        <DialogActions cancelLabel={cancelLabel} onCancel={() => onOpenChange(false)}>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            loadingLabel={pendingLabel}
            onClick={onConfirm}
          >
            <ConfirmIcon aria-hidden="true" />
            {confirmLabel}
          </Button>
        </DialogActions>
      </div>
    </Dialog>
  );
}
