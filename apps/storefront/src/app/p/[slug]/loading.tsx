import { Skeleton } from '@hakorem/ui';
import { getT } from '../../../i18n/server';

export default async function Loading() {
  const t = await getT('storefront');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Skeleton label={t('product.loading')} shape="block" className="h-64" />
      <div className="grid content-start gap-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  );
}
