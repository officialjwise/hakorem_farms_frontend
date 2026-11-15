import { CircleCheck, CircleDashed, CircleX, Clock, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge } from '@hakorem/ui';

type VersionStatus = components['schemas']['PriceListVersion']['status'];

const BADGE = {
  DRAFT: { tone: 'info', icon: CircleDashed },
  PENDING_APPROVAL: { tone: 'warning', icon: Clock },
  ACTIVE: { tone: 'good', icon: CircleCheck },
  SUPERSEDED: { tone: 'slate', icon: History },
  REJECTED: { tone: 'critical', icon: CircleX },
} as const;

/** A price list version's state in words and an icon, never colour alone. */
export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const { t } = useTranslation('catalogue');
  const { tone, icon } = BADGE[status];
  return <StatusBadge tone={tone} icon={icon} label={t(`versionStatus.${status}`)} />;
}
