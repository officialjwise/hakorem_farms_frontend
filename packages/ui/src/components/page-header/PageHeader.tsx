import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type PageHeaderProps<T extends string = string> = {
  /** Required. The page's one h1. */
  title: NonEmpty<T>;
  /** The id the page's landmark points at with aria-labelledby. */
  titleId?: string;
  /** One line under the title, such as what the page is for or the branch it shows. */
  description?: ReactNode;
  /** When the figures were produced, already formatted with its time zone ("Generated 14:05, Accra"). */
  generatedAt?: ReactNode;
  /** Re-reads the page's data. Shown beside `generatedAt`. */
  refresh?: { label: string; onRefresh: () => void; refreshing: boolean; refreshingLabel: string };
  /** The page's primary actions, on the right: buttons, links and an export menu. */
  actions?: ReactNode;
  className?: string;
};

/**
 * PageHeader. Every back office page opens the same way: its title, one line about it, when its figures
 * were generated with a refresh, and its primary actions on the right. On a phone the actions wrap below.
 */
export function PageHeader<T extends string>({
  title,
  titleId,
  description,
  generatedAt,
  refresh,
  actions,
  className,
}: PageHeaderProps<T>) {
  if (title.trim() === '') throw new Error('PageHeader needs a non-empty title.');
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-wrap items-start justify-between gap-3', className)}
    >
      <div className="grid min-w-0 gap-1">
        <h1 id={titleId} className="text-2xl font-semibold text-fg">
          {title}
        </h1>
        {description === undefined ? null : <p className="text-sm text-fg-muted">{description}</p>}
        {generatedAt === undefined && refresh === undefined ? null : (
          <p className="flex flex-wrap items-center gap-x-2 text-control-sm text-fg-muted">
            {generatedAt}
            {refresh === undefined ? null : (
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh.onRefresh}
                loading={refresh.refreshing}
                loadingLabel={refresh.refreshingLabel}
              >
                <RefreshCw aria-hidden="true" />
                {refresh.label}
              </Button>
            )}
          </p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
