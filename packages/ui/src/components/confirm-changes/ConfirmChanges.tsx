'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { Dialog } from '../dialog/Dialog';

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
}: ConfirmChangesProps<T>) {
  const showBefore = changes?.some((row) => row.before !== undefined) ?? false;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={cancelLabel}
    >
      <div data-slot="confirm-changes" className="grid gap-3 pb-2">
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
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
