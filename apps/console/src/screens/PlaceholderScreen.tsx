import { useTranslation } from 'react-i18next';
import { EmptyState } from '@hakorem/ui';

type Area = 'dashboard' | 'stock' | 'products' | 'orders';

/**
 * Stands in for a screen a later session builds. It has no data, so it has no loading or error state of its
 * own: it is the empty state, and the session and permission states come from the gates above it.
 */
export function PlaceholderScreen({ area }: { area: Area }) {
  const { t } = useTranslation('shell');
  return (
    <section aria-labelledby="placeholder-title">
      <h1 id="placeholder-title" className="mb-3 text-2xl font-semibold">
        {t(`nav.${area}`)}
      </h1>
      <EmptyState
        title={t('placeholder.title')}
        description={t('placeholder.body', { area: t(`placeholder.area.${area}`) })}
      />
    </section>
  );
}
