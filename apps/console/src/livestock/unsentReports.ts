import { useCallback, useState } from 'react';

/**
 * Deaths reported from this device but not yet sent for approval (ADR 0039). The Farm hand cannot read
 * mortality records (no `liv.mortality.read`), and the contract has no cost-free read of their own reports
 * (CR-024), so a report whose submit did not get through would otherwise have no page to be sent from.
 * The report page keeps each one here, by the reporter, until its submit is answered, and lists it with
 * "Send it again".
 *
 * Only what the page needs to send it and to say which it is: the record's id, the tag and the kind. The
 * record itself is the server's; this is a reminder kept in this browser. It survives a reload and a lost
 * signal, not a lost phone (CR-024 is the fix for that). Every read and write survives blocked storage.
 */
export interface UnsentReport {
  id: string;
  tagNo: string;
  kind: 'DEATH' | 'CULL';
  reportedAt: string;
}

const keyFor = (principalId: string) => `hk-unsent-deaths:${principalId}`;

function isUnsent(value: unknown): value is UnsentReport {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    typeof row['tagNo'] === 'string' &&
    (row['kind'] === 'DEATH' || row['kind'] === 'CULL') &&
    typeof row['reportedAt'] === 'string'
  );
}

export function readUnsent(principalId: string): UnsentReport[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(keyFor(principalId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isUnsent) : [];
  } catch {
    return [];
  }
}

function writeUnsent(principalId: string, rows: readonly UnsentReport[]) {
  try {
    if (rows.length === 0) window.localStorage.removeItem(keyFor(principalId));
    else window.localStorage.setItem(keyFor(principalId), JSON.stringify(rows));
  } catch {
    // Storage blocked: the reminder lasts while the page is open.
  }
}

/** The reporter's unsent reports, newest first, with ways to add and drop one. */
export function useUnsentReports(principalId: string) {
  const [rows, setRows] = useState<UnsentReport[]>(() => readUnsent(principalId));
  const remember = useCallback(
    (row: UnsentReport) => {
      const next = [row, ...readUnsent(principalId).filter((r) => r.id !== row.id)];
      writeUnsent(principalId, next);
      setRows(next);
    },
    [principalId],
  );
  const forget = useCallback(
    (id: string) => {
      const next = readUnsent(principalId).filter((r) => r.id !== id);
      writeUnsent(principalId, next);
      setRows(next);
    },
    [principalId],
  );
  return { rows, remember, forget };
}
