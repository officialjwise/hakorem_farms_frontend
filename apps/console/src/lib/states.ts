import { useTranslation } from 'react-i18next';
import type { QueryBoundaryLabels } from '@hakorem/ui';

/** The words that name what this screen is about. The rest of a QueryBoundary's labels are the same everywhere. */
export interface ScreenStateWords {
  loading: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  deniedTitle: string;
  deniedDescription?: string;
}

/**
 * QueryBoundary's labels (ADR 0023): the screen's own titles, plus the shared retry, reference and
 * explanations from `common.states`, so every screen says them the same way.
 */
export function useStateLabels(words: ScreenStateWords): QueryBoundaryLabels {
  const { t } = useTranslation('common');
  return {
    errorDescription: t('states.errorBody'),
    retry: t('states.retry'),
    reference: t('states.reference'),
    deniedDescription: t('states.deniedBody'),
    ...words,
  };
}
