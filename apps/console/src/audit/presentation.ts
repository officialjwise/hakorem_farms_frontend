import type { components } from '@hakorem/api-client';

export type AuditEvent = components['schemas']['AuditEvent'];
export type AuditAction = AuditEvent['action'];

/** Every action the contract names, in its own order, for the filter. */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'PERMISSION_CHANGE',
  'PRICE_OVERRIDE',
  'APPROVAL',
  'EXPORT',
  'DECRYPT',
  'SETTING_CHANGE',
  'VOID',
  'POST',
];

export interface ChangeRow {
  field: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

/** A value as text: strings as they are, anything else as compact JSON. `null` stays null (shown as "not set"). */
export function show(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * The before and after values side by side, one row per field either side names, in field order. Values
 * are shown as recorded: "[erased]" and "[redacted]" are the server's own words (AuditEvent.before).
 */
export function changeRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ChangeRow[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  return fields.map((field) => {
    const was = show(before?.[field]);
    const now = show(after?.[field]);
    return { field, before: was, after: now, changed: was !== now };
  });
}
