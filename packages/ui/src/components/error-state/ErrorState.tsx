import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { formatReference } from '../../format/format';
import { CopyId, type CopyLabels } from '../copy-id/CopyId';
import type { BadgeIcon } from '../status-badge/StatusBadge';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

type ReferenceProps =
  | { reference?: undefined; referenceLabel?: never; referenceCopy?: never }
  | {
      /**
       * Something to quote to support: the correlation id of a failed request, so a support call starts
       * with a reference instead of a guess, or a plain reference such as a permission's name. Blank shows
       * nothing.
       */
      reference: string;
      referenceLabel: string;
      /**
       * Given for a request reference (a correlation id), always: it is then shown by its last eight
       * characters in two groups (`formatReference`) with a button that copies all of it (owner,
       * 2026-11-17; ADR 0051). Without it the reference is shown whole, for one a person reads in full.
       */
      referenceCopy?: CopyLabels;
    };

export type ErrorStateProps<L extends string = string> = ReferenceProps & {
  /** Required. What went wrong, in words, already translated. */
  title: NonEmpty<L>;
  description?: string;
  /** For example a "Try again" button. */
  action?: ReactNode;
  /** Defaults to a warning triangle. A screen passes a lock for permission denied. */
  icon?: BadgeIcon;
  /** Less vertical room, for use inside a card or a table row. */
  compact?: boolean;
  className?: string;
};

/** ErrorState. Something failed or is not allowed. Announced as an alert. */
export function ErrorState<L extends string>({
  title,
  description,
  action,
  icon: Icon = TriangleAlert,
  compact = false,
  reference,
  referenceLabel,
  referenceCopy,
  className,
}: ErrorStateProps<L>) {
  if (title.trim() === '') {
    throw new Error('ErrorState needs a non-empty title.');
  }
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-2 text-center',
        compact ? 'py-4' : 'py-10',
        className,
      )}
    >
      <Icon aria-hidden="true" focusable="false" className="size-7 stroke-critical" />
      <p className="text-base font-semibold text-balance text-fg">{title}</p>
      {description ? <p className="text-sm text-balance text-fg-muted">{description}</p> : null}
      {reference === undefined || reference.trim() === '' ? null : referenceCopy === undefined ? (
        <p className="text-xs text-fg-muted">
          {referenceLabel} <code className="font-mono text-fg">{reference}</code>
        </p>
      ) : (
        <p className="text-xs text-fg-muted">
          {referenceLabel}{' '}
          <CopyId
            value={reference}
            shown={formatReference(reference)}
            copyLabel={referenceCopy.copy}
            copiedLabel={referenceCopy.copied}
            failedLabel={referenceCopy.failed}
          />
        </p>
      )}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
