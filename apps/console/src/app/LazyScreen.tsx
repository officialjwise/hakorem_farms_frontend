import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@hakorem/ui';

/** What a route shows while its screen's chunk downloads: the loading state, in words. */
export function RouteLoading() {
  const { t } = useTranslation('shell');
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <Skeleton label={t('route.loading')} shape="block" />
      </div>
    </div>
  );
}

/**
 * A screen that downloads when its route is first opened, not with the document (PERFORMANCE_BUDGET,
 * "The till loads its sale screen and nothing else"). `routes.test.ts` recognises a lazy route by this
 * component, so a till route that is not lazy fails a test, not only the budget.
 */
export function LazyScreen({ screen: Screen }: { screen: LazyExoticComponent<ComponentType> }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Screen />
    </Suspense>
  );
}

/** A route element for a screen loaded on demand. Call it at module level, once per screen. */
export function lazyScreen(load: () => Promise<ComponentType>) {
  const screen = lazy(async () => ({ default: await load() }));
  return <LazyScreen screen={screen} />;
}
