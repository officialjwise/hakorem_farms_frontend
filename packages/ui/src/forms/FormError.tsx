import { ErrorState } from '../components/error-state/ErrorState';
import { Button } from '../components/button/Button';
import type { CopyLabels } from '../components/copy-id/CopyId';
import type { ServerFailure } from './serverErrors';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

type DismissProps =
  { onDismiss?: undefined; dismissLabel?: never } | { onDismiss: () => void; dismissLabel: string };

export type FormErrorProps<L extends string = string> = DismissProps & {
  /** The failure from mapServerErrors, or null for none: nothing renders. Held by the form's owner. */
  failure: ServerFailure | null;
  /** Required. What did not happen, in words, already translated, for example "The sale was not saved". */
  title: NonEmpty<L>;
  /** The label before the correlation id, for example "Reference". */
  referenceLabel: string;
  /** The reference's copy button: it shows the last eight characters and copies all of it (ADR 0051). */
  referenceCopy: CopyLabels;
  className?: string;
};

/**
 * FormError. The PERSISTENT form-level failure.
 *
 * A FAILED MONEY OR STOCK OPERATION ALWAYS LEAVES A FORMERROR (OR AN EQUIVALENT
 * ON-SCREEN RECORD) AND NEVER ONLY A TOAST (ADR 0006). A toast vanishes in five
 * seconds and is not an audit trail.
 *
 * It stays on screen until its owner clears `failure`: on the next successful
 * submit, or when the operator dismisses it. It shows the server's message, the
 * details that did not land on a field, and the correlation reference, so a
 * support call starts with a reference instead of a guess. It is an alert, and
 * reuses ErrorState's markup so it adds no new look.
 */
export function FormError<L extends string>({
  failure,
  title,
  referenceLabel,
  referenceCopy,
  onDismiss,
  dismissLabel,
  className,
}: FormErrorProps<L>) {
  if (title.trim() === '') {
    throw new Error('FormError needs a non-empty title.');
  }
  if (failure === null) return null;

  const action =
    failure.unmapped.length > 0 || onDismiss !== undefined ? (
      <div className="grid gap-2">
        {failure.unmapped.length > 0 ? (
          <ul data-slot="form-error-details" className="list-disc text-start text-sm text-fg ps-5">
            {failure.unmapped.map((detail, index) => (
              <li key={`${detail.code}-${index}`}>{detail.message}</li>
            ))}
          </ul>
        ) : null}
        {onDismiss ? (
          <div>
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              {dismissLabel}
            </Button>
          </div>
        ) : null}
      </div>
    ) : undefined;

  return (
    <div data-slot="form-error" className={className}>
      <ErrorState
        compact
        title={title}
        description={failure.message}
        reference={failure.correlationId}
        referenceLabel={referenceLabel}
        referenceCopy={referenceCopy}
        action={action}
      />
    </div>
  );
}
