import { CircleCheck, CircleDashed, CircleSlash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type ProductStatus = components['schemas']['Product']['status'];

const BADGE = {
  ACTIVE: { tone: 'good', icon: CircleCheck },
  DRAFT: { tone: 'info', icon: CircleDashed },
  DISCONTINUED: { tone: 'slate', icon: CircleSlash },
} as const;

/** A product's status in words and an icon, never colour alone. */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { t } = useTranslation('catalogue');
  const { tone, icon } = lookup(BADGE, status, UNKNOWN);
  return (
    <StatusBadge
      tone={tone}
      icon={icon}
      label={t(`productStatus.${status}`, { defaultValue: status })}
    />
  );
}
