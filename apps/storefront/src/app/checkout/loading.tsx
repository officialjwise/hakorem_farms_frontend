import { Skeleton } from '@hakorem/ui';
import { getT } from '../../i18n/server';

export default async function Loading() {
  const t = await getT('storefront');
  return (
    <div className="grid gap-3">
      <Skeleton label={t('checkout.loading')} className="h-8 w-48" />
      <Skeleton shape="block" />
    </div>
  );
}
