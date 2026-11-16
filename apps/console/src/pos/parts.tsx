import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@hakorem/ui';
import type { SaleEntry } from './offline/types';

/**
 * Parts of the till's initial screens that load on demand (PERFORMANCE_BUDGET, "The till loads its sale
 * screen and nothing else"): the receipt panel, with the printer and its ESC/POS encoder, and the lock
 * screen. `preloadTillScreens` fetches them once the till is ready, so they open offline afterwards, as
 * the till's other screens do (ADR 0043). A sale never waits for either.
 */
export const TILL_PARTS = {
  receiptOut: () => import('./sale/ReceiptOut'),
  tillLocked: () => import('./pin/TillLocked'),
};

const ReceiptOutPart = lazy(async () => ({ default: (await TILL_PARTS.receiptOut()).ReceiptOut }));
const TillLockedPart = lazy(async () => ({ default: (await TILL_PARTS.tillLocked()).TillLocked }));

function PartLoading() {
  const { t } = useTranslation('shell');
  return <Skeleton label={t('route.loading')} shape="block" />;
}

export function LazyReceiptOut(props: { entry: SaleEntry; copy?: boolean }) {
  return (
    <Suspense fallback={<PartLoading />}>
      <ReceiptOutPart {...props} />
    </Suspense>
  );
}

export function LazyTillLocked() {
  return (
    <Suspense fallback={<PartLoading />}>
      <TillLockedPart />
    </Suspense>
  );
}
