import { PawPrint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import { IconChip, useTableView, type TableColumn } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useApiAllPages } from '../data/api';
import { uniqueById } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';

type Species = components['schemas']['Species'];

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
  const columns: TableColumn<Species>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('species.columns.name'),
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <IconChip icon={PawPrint} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/species/${s.id}`} className="text-accent-text hover:underline">
              {s.name}
            </Link>
            <code className="text-control-sm font-normal text-fg-muted">{s.code}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'tracking',
      head: t('species.columns.tracking'),
      sortValue: (s) => t(`tracking.${s.trackingDefault}`),
      cell: (s) => t(`tracking.${s.trackingDefault}`),
    },
    {
      id: 'grades',
      head: t('species.columns.grades'),
      numeric: true,
      sortValue: (s) => s.gradeCount,
      cell: (s) => s.gradeCount,
    },
    {
      id: 'bands',
      head: t('species.columns.bands'),
      numeric: true,
      sortValue: (s) => s.weightBandCount,
      cell: (s) => s.weightBandCount,
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="species-title" className="grid gap-4">
      <PageHeader title={t('species.title')} titleId="species-title" />
      <p className="text-fg-muted">{t('species.intro')}</p>
      <TableCard
        view={view}
        query={species}
        labels={labels}
        rows={(all) => uniqueById(all.items)}
        rowKey={(s) => s.id}
        tableLabel={t('species.table')}
        exportName={t('species.title')}
      />
    </section>
  );
}
