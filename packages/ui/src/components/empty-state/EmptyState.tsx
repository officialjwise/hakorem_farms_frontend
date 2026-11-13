import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeIcon } from '../status-badge/StatusBadge';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type EmptyStateProps<L extends string = string> = {
  /** Required. What is empty, in words, already translated. */
  title: NonEmpty<L>;
  description?: string;
  /** For example a "Receive stock" button. */
  action?: ReactNode;
  /** Defaults to an inbox. Any lucide-style icon component. */
  icon?: BadgeIcon;
  /** Less vertical room, for use inside a card or a table row. */
  compact?: boolean;
  className?: string;
};

/** EmptyState. Nothing to show yet, and what to do about it. Not an error: it carries no alert role. */
export function EmptyState<L extends string>({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
  className,
}: EmptyStateProps<L>) {
  if (title.trim() === '') {
    throw new Error('EmptyState needs a non-empty title.');
  }
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-2 text-center',
        compact ? 'py-4' : 'py-10',
        className,
      )}
    >
      <Icon aria-hidden="true" focusable="false" className="size-7 text-fg-muted" />
      <p className="text-base font-semibold text-balance text-fg">{title}</p>
      {description ? <p className="text-sm text-balance text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
