import { useTranslation } from 'react-i18next';
import { EmptyState } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';

type Area = 'dashboard' | 'stock' | 'products' | 'orders';

/**
 * Stands in for a screen a later session builds. It has no data, so it has no loading or error state of its
 * own: it is the empty state, and the session and permission states come from the gates above it.
 */
export function PlaceholderScreen({ area }: { area: Area }) {
  const { t } = useTranslation(['shell', 'nav']);
  return (
    <section aria-labelledby="placeholder-title">
      <PageHeader title={t(`nav:${area}`)} titleId="placeholder-title" className="mb-3" />
      <EmptyState
        title={t('placeholder.title')}
        description={t('placeholder.body', { area: t(`placeholder.area.${area}`) })}
      />
    </section>
  );
}
