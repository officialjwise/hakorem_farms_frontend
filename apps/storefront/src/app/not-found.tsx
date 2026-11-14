import Link from 'next/link';
import { Button, EmptyState } from '@hakorem/ui';
import { getT } from '../i18n/server';

export default async function NotFound() {
  const t = await getT('storefront');
  return (
    <EmptyState
      title={t('notFound.title')}
      description={t('notFound.body')}
      action={
        <Button asChild>
          <Link href="/">{t('notFound.home')}</Link>
        </Button>
      }
    />
  );
}
