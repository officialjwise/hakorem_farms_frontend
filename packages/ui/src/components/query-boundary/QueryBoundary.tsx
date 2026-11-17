'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../button/Button';
import type { CopyLabels } from '../copy-id/CopyId';
import { EmptyState } from '../empty-state/EmptyState';
import { ErrorState } from '../error-state/ErrorState';
import { Skeleton } from '../skeleton/Skeleton';

/**
 * The part of a failed call these components read. `ApiError` from the data layer satisfies it, and so
 * does any object with these four fields: this package imports nothing from the data layer (ADR 0023).
 */
export interface FailureLike {
  /** The HTTP status, or 0 when there was no answer. 403 is permission denied. */
  status: number;
  /** The contract's error code, or one of the client's own (NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE). */
  code: string;
  /** A sentence the server marks as safe to show. */
  message: string;
  /** The reference to quote to support. Empty when the failure happened before any answer. */
  correlationId: string;
}

/** The part of a TanStack Query result `QueryBoundary` reads. A `useQuery` result satisfies it as is. */
export interface QueryLike<TData, TError extends FailureLike = FailureLike> {
  status: 'pending' | 'error' | 'success';
  data: TData | undefined;
  error: TError | null;
  refetch: () => unknown;
}

/** Codes the client invents when no usable envelope came back (`CLIENT_ERROR_CODES` in the data layer). */
const CLIENT_CODES: readonly string[] = ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'];

/** The words for the four screen states. Already translated: this package holds no copy. */
export interface QueryBoundaryLabels {
  /** Announced once while loading, for example "Loading products". */
  loading: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  /** Shown when the failure has no server message worth showing (no connection, a timeout, a bad reply). */
  errorDescription?: string;
  /** The retry button, for example "Try again". */
  retry: string;
  /** The words before the reference, for example "Quote this reference to support:". */
  reference: string;
  /**
   * The reference's copy button. The reference shows its last eight characters and the button copies
   * all of it (ADR 0051).
   */
  referenceCopy: CopyLabels;
  deniedTitle: string;
  deniedDescription?: string;
}

export interface QueryBoundaryProps<TData, TError extends FailureLike = FailureLike> {
  query: QueryLike<TData, TError>;
  labels: QueryBoundaryLabels;
  /** True when a successful answer has nothing to show (an empty page). */
  isEmpty: (data: TData) => boolean;
  /** For the empty state, for example a "Receive stock" button. */
  emptyAction?: ReactNode;
  /**
   * Shows permission denied without asking the server, for a screen that already knows from the session
   * that the user lacks the permission. The server still enforces it.
   */
  denied?: boolean;
  /** Replaces the default loading placeholder with one of the screen's own shape, for example table rows. */
  loadingFallback?: ReactNode;
  /** The happy path. Called only with data. */
  children: (data: TData) => ReactNode;
}

/** What a failed call shows: permission denied for a 403, otherwise an error with its reference and a retry. */
function FailureState({
  error,
  labels,
  onRetry,
  compact,
}: {
  error: FailureLike;
  labels: Pick<
    QueryBoundaryLabels,
    | 'errorTitle'
    | 'errorDescription'
    | 'retry'
    | 'reference'
    | 'referenceCopy'
    | 'deniedTitle'
    | 'deniedDescription'
  >;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (error.status === 403) {
    return (
      <ErrorState
        icon={Lock}
        compact={compact}
        title={labels.deniedTitle}
        description={labels.deniedDescription}
      />
    );
  }
  const description = CLIENT_CODES.includes(error.code) ? labels.errorDescription : error.message;
  const retry =
    onRetry === undefined ? undefined : (
      <Button variant="secondary" onClick={onRetry}>
        {labels.retry}
      </Button>
    );
  return error.correlationId === '' ? (
    <ErrorState
      compact={compact}
      title={labels.errorTitle}
      description={description}
      action={retry}
    />
  ) : (
    <ErrorState
      compact={compact}
      title={labels.errorTitle}
      description={description}
      reference={error.correlationId}
      referenceLabel={labels.reference}
      referenceCopy={labels.referenceCopy}
      action={retry}
    />
  );
}

/**
 * QueryBoundary. The loading, empty, error and permission-denied states of a screen, wired to a query so
 * no screen builds them by hand (docs/BUILD_PROMPT.md, F2). A 403 is permission denied, in words and on
 * the same URL. Any other failure shows the server's safe message (or the screen's own words for a
 * client failure), the correlation id and a retry. Data is shown only when there is some.
 */
export function QueryBoundary<TData, TError extends FailureLike = FailureLike>({
  query,
  labels,
  isEmpty,
  emptyAction,
  denied = false,
  loadingFallback,
  children,
}: QueryBoundaryProps<TData, TError>) {
  if (denied) {
    return (
      <ErrorState icon={Lock} title={labels.deniedTitle} description={labels.deniedDescription} />
    );
  }
  if (query.status === 'error' && query.error !== null) {
    return (
      <FailureState error={query.error} labels={labels} onRetry={() => void query.refetch()} />
    );
  }
  if (query.status === 'pending' || query.data === undefined) {
    return (
      loadingFallback ?? (
        <div className="flex flex-col gap-3">
          <Skeleton label={labels.loading} className="h-6" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </div>
      )
    );
  }
  if (isEmpty(query.data)) {
    return (
      <EmptyState
        title={labels.emptyTitle}
        description={labels.emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children(query.data)}</>;
}

export interface MutationFailureProps {
  /** A mutation's `error`. Nothing renders while it is null. */
  error: FailureLike | null;
  labels: Pick<
    QueryBoundaryLabels,
    | 'errorTitle'
    | 'errorDescription'
    | 'retry'
    | 'reference'
    | 'referenceCopy'
    | 'deniedTitle'
    | 'deniedDescription'
  >;
  /** Retries the same user intent, with the same idempotency key. Omit for no retry button. */
  onRetry?: () => void;
}

/**
 * MutationFailure. A failed write leaves persistent words on screen (an alert that stays until the next
 * attempt starts), never only a toast (ADR 0006). Same wording rules as QueryBoundary.
 */
export function MutationFailure({ error, labels, onRetry }: MutationFailureProps) {
  if (error === null) return null;
  return <FailureState error={error} labels={labels} onRetry={onRetry} compact />;
}
