import { ListingLoading } from '../../../components/ListingLoading';
import { getT } from '../../../i18n/server';

export default async function Loading() {
  const t = await getT('storefront');
  return <ListingLoading label={t('listing.loading')} />;
}
