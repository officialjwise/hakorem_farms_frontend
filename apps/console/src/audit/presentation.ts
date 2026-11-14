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

/**
 * A day picked in the filter as the instant range the contract's `from` and `to` take. Accra is UTC+0 all
 * year (ADR 0027), so an Accra day is the UTC day: from its first millisecond to its last.
 */
export function dayStart(day: string): string {
  return `${day}T00:00:00.000Z`;
}
export function dayEnd(day: string): string {
  return `${day}T23:59:59.999Z`;
}

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
