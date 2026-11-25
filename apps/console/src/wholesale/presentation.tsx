import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
type QuoteStatus = S['Quote']['status'];
type VersionStatus = S['QuoteVersion']['status'];
type RfqStatus = S['Rfq']['status'];
type AccountStatus = S['BusinessAccount']['status'];

/** Every state a quote can be in, in the order it moves through them. */
export const QUOTE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ISSUED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED',
] as const satisfies readonly QuoteStatus[];

/** Every state a request for quote can be in. */
export const RFQ_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'QUOTED',
  'CLOSED',
  'SPAM',
] as const satisfies readonly RfqStatus[];

/** Every state a business account can be in. */
export const ACCOUNT_STATUSES = [
  'ACTIVE',
  'ON_HOLD',
  'CLOSED',
] as const satisfies readonly AccountStatus[];

/** The channels a quote's acceptance link is sent by (`QuoteIssue.channels`). */
export const ISSUE_CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL'] as const satisfies readonly NonNullable<
  S['QuoteIssue']['channels']
>[number][];

const QUOTE_LOOK: Record<QuoteStatus, { tone: BadgeTone }> = {
  DRAFT: { tone: 'info' },
  PENDING_APPROVAL: { tone: 'warning' },
  ISSUED: { tone: 'violet' },
  ACCEPTED: { tone: 'good' },
  DECLINED: { tone: 'critical' },
  EXPIRED: { tone: 'slate' },
  CONVERTED: { tone: 'plum' },
  CANCELLED: { tone: 'slate' },
};

const VERSION_LOOK: Record<VersionStatus, { tone: BadgeTone }> = {
  DRAFT: { tone: 'info' },
  PENDING_APPROVAL: { tone: 'warning' },
  APPROVED: { tone: 'info' },
  ISSUED: { tone: 'violet' },
  SUPERSEDED: { tone: 'slate' },
  ACCEPTED: { tone: 'good' },
};

const RFQ_LOOK: Record<RfqStatus, { tone: BadgeTone }> = {
  NEW: { tone: 'warning' },
  IN_PROGRESS: { tone: 'info' },
  QUOTED: { tone: 'good' },
  CLOSED: { tone: 'slate' },
  SPAM: { tone: 'critical' },
};

const ACCOUNT_LOOK: Record<AccountStatus, { tone: BadgeTone }> = {
  ACTIVE: { tone: 'good' },
  ON_HOLD: { tone: 'critical' },
  CLOSED: { tone: 'slate' },
};

/** A quote's state in words, with a tone and a dot (ADR 0036). */
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(QUOTE_LOOK, status, UNKNOWN).tone}
      label={t(`quoteStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** One version's state in words: a superseded version stays readable, marked as replaced. */
export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(VERSION_LOOK, status, UNKNOWN).tone}
      label={t(`versionStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** A request for quote's state in words. */
export function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(RFQ_LOOK, status, UNKNOWN).tone}
      label={t(`rfqStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** A business account's state in words: on hold is said, never only coloured. */
export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(ACCOUNT_LOOK, status, UNKNOWN).tone}
      label={t(`accountStatus.${status}`, { defaultValue: status })}
    />
  );
}

type StandingStatus = S['StandingOrder']['status'];
type RunOutcome = S['StandingOrderRun']['outcome'];

const STANDING_LOOK: Record<StandingStatus, { tone: BadgeTone }> = {
  ACTIVE: { tone: 'good' },
  PAUSED: { tone: 'warning' },
  ENDED: { tone: 'slate' },
  CANCELLED: { tone: 'slate' },
};

const RUN_LOOK: Record<RunOutcome, { tone: BadgeTone }> = {
  CREATED: { tone: 'good' },
  HELD_FOR_CREDIT: { tone: 'warning' },
  SKIPPED_ON_HOLD: { tone: 'critical' },
  SKIPPED_NO_PRICE: { tone: 'warning' },
  MISSED: { tone: 'critical' },
  FAILED: { tone: 'critical' },
};

/** A standing order's state in words: paused and ended are said, never only coloured. */
export function StandingOrderStatusBadge({ status }: { status: StandingStatus }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(STANDING_LOOK, status, UNKNOWN).tone}
      label={t(`standing.status.${status}`, { defaultValue: status })}
    />
  );
}

/** What one run of a standing order did, in words: an order made, held for credit, or none and why. */
export function RunOutcomeBadge({ outcome }: { outcome: RunOutcome }) {
  const { t } = useTranslation('wholesale');
  return (
    <StatusBadge
      tone={lookup(RUN_LOOK, outcome, UNKNOWN).tone}
      label={t(`runs.outcome.${outcome}`, { defaultValue: outcome })}
    />
  );
}

/** "QUO-2026-DDW-000088", or "Draft quote" before the server numbers it. */
export function useQuoteName(): (quote: Pick<S['Quote'], 'quoteNo'>) => string {
  const { t } = useTranslation('wholesale');
  return (quote) => quote.quoteNo ?? t('quote.unnumbered');
}
