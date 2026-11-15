import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { useApiAllPages } from '../data/api';
import { uniqueById } from '../lib/queries';
import { useStateLabels } from '../lib/states';

/** FR-MDM: the species, each with the grades and weight bands that pricing and quoting use. */
export function SpeciesScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  // A short reference list (ADR 0028): `reference`.
  const species = useApiAllPages(
    'listSpeciesList',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('species.loading'),
    emptyTitle: t('species.empty'),
    emptyDescription: t('species.emptyBody'),
    errorTitle: t('species.error'),
    deniedTitle: t('species.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('species.columns.name')}</TableHead>
        <TableHead>{t('species.columns.tracking')}</TableHead>
        <TableHead numeric>{t('species.columns.grades')}</TableHead>
        <TableHead numeric>{t('species.columns.bands')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="species-title" className="grid gap-4">
      <h1 id="species-title" className="text-2xl font-semibold">
        {t('species.title')}
      </h1>
      <p className="text-fg-muted">{t('species.intro')}</p>
      <QueryBoundary
        query={species}
        labels={labels}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('species.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={4} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(all) => (
          <TableContainer aria-label={t('species.table')}>
            <Table>
              {header}
              <TableBody>
                {uniqueById(all.items).map((s) => (
                  <TableRow key={s.id}>
                    <TableRowHeader>
                      <Link to={`/species/${s.id}`} className="text-accent-text underline">
                        {s.name}
                      </Link>
                    </TableRowHeader>
                    <TableCell label={t('species.columns.tracking')}>
                      {t(`tracking.${s.trackingDefault}`)}
                    </TableCell>
                    <TableCell numeric label={t('species.columns.grades')}>
                      {s.gradeCount}
                    </TableCell>
                    <TableCell numeric label={t('species.columns.bands')}>
                      {s.weightBandCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </section>
  );
}
