import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, EmptyState } from '@hakorem/ui';

export function NotFoundScreen() {
  const { t } = useTranslation('shell');
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <EmptyState
        title={t('notFound.title')}
        description={t('notFound.body')}
        action={
          <Button asChild>
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        }
      />
    </main>
  );
}
