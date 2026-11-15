import { CircleCheck, CircleSlash, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, formatDateTime } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

export type UserAccount = components['schemas']['UserAccount'];
export type UserStatus = UserAccount['status'];
export type GrantSummary = components['schemas']['GrantSummary'];

const STATUS = {
  ACTIVE: { tone: 'good', icon: CircleCheck },
  DISABLED: { tone: 'critical', icon: CircleSlash },
  LOCKED: { tone: 'warning', icon: LockKeyhole },
} as const;

/** An account's status: icon and words as well as colour (StatusBadge). */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation('iam');
  return (
    <StatusBadge
      tone={lookup(STATUS, status, UNKNOWN).tone}
      icon={lookup(STATUS, status, UNKNOWN).icon}
      label={t(`status.${status}`, { defaultValue: status })}
    />
  );
}

/** Email, phone, or both, as the account has them. */
export function contactOf(user: Pick<UserAccount, 'email' | 'phone'>): string {
  return [user.email, user.phone].filter((value) => value !== null && value !== '').join(' · ');
}

/** "Cashier at DDW", one per grant. */
export function rolesOf(grants: readonly GrantSummary[]): string[] {
  return grants.map((grant) =>
    grant.locationCode === null
      ? `${grant.roleName} (${grant.branchCode})`
      : `${grant.roleName} (${grant.branchCode}, ${grant.locationCode})`,
  );
}

/** A timestamp in Accra time inside `<time>`, so the exact instant stays in the markup (ADR 0027). */
export function When({ instant, empty }: { instant: string | null; empty?: string }) {
  if (instant === null) return <>{empty ?? formatDateTime(null)}</>;
  return <time dateTime={instant}>{formatDateTime(instant)}</time>;
}
