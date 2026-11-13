import type { FieldValues, UseFormReturn } from 'react-hook-form';

/** One entry of the contract's `ErrorDetail`. `field` is a JSON pointer, or null when the error is about the whole request. */
export interface ServerErrorDetail {
  field: string | null;
  code: string;
  message: string;
}

/**
 * The contract's single error envelope, typed structurally here: there is no
 * generated client yet (F2), and this package imports nothing from one.
 */
export interface ServerErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details: readonly ServerErrorDetail[];
  };
}

/** What a FormError shows: the message, the reference, and every detail that is not on a field. */
export interface ServerFailure {
  code: string;
  message: string;
  correlationId: string;
  /** Details with no field, or a field this form does not have. Shown by FormError. */
  unmapped: readonly ServerErrorDetail[];
}

/** True when `value` has the envelope's shape, so a catch block can tell a server error from a thrown bug. */
export function isServerErrorEnvelope(value: unknown): value is ServerErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === 'string' &&
    typeof e.message === 'string' &&
    typeof e.correlationId === 'string' &&
    Array.isArray(e.details) &&
    e.details.every(
      (d: unknown) =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as ServerErrorDetail).code === 'string' &&
        typeof (d as ServerErrorDetail).message === 'string' &&
        ((d as ServerErrorDetail).field === null ||
          typeof (d as ServerErrorDetail).field === 'string'),
    )
  );
}

/**
 * An RFC 6901 JSON pointer to a react-hook-form field name: `/items/0/qty`
 * becomes `items.0.qty`. `~1` is `/` and `~0` is `~`, in that order. Returns
 * null for the whole document (`""`), and for a pointer whose parts cannot be
 * a form path (an empty part, or one containing `.`, `[` or `]`).
 */
export function pointerToFieldName(pointer: string): string | null {
  if (pointer === '' || !pointer.startsWith('/')) return null;
  const parts = pointer
    .slice(1)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (parts.some((part) => part === '' || /[.[\]]/.test(part))) return null;
  return parts.join('.');
}

function hasValueAt(values: unknown, path: string): boolean {
  let current: unknown = values;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null) return false;
    if (!Object.hasOwn(current, key)) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

/**
 * Puts each server detail that names a field of this form onto that field
 * (`setError` with type `server`, so Field shows it and sets aria-invalid), and
 * returns everything else for FormError. A field counts as the form's when it
 * has a value, so list every field in `defaultValues`. The first mapped field
 * takes focus.
 */
export function mapServerErrors<TValues extends FieldValues, TContext, TOutput extends FieldValues>(
  envelope: ServerErrorEnvelope,
  form: Pick<UseFormReturn<TValues, TContext, TOutput>, 'setError' | 'getValues'>,
): ServerFailure {
  const { code, message, correlationId, details } = envelope.error;
  const values = form.getValues();
  const unmapped: ServerErrorDetail[] = [];
  let focused = false;

  for (const detail of details) {
    const name = detail.field === null ? null : pointerToFieldName(detail.field);
    if (name === null || !hasValueAt(values, name)) {
      unmapped.push(detail);
      continue;
    }
    form.setError(
      name as Parameters<typeof form.setError>[0],
      { type: 'server', message: detail.message },
      { shouldFocus: !focused },
    );
    focused = true;
  }
  return { code, message, correlationId, unmapped };
}
