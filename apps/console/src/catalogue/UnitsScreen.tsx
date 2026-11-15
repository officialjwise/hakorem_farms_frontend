import { Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { IconChip, useTableView, type TableColumn } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useApiAllPages } from '../data/api';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';

type Unit = components['schemas']['Uom'];

/**
 * FR-MDM units of measure. Read only: contract 1.1.0 lists units (`listUnitsOfMeasure`) but has no way to add
 * or change one, and no conversions between them (A-F4-05). Display precision follows the unit's kind until
 * CR-003 adds it to the contract.
 */
export function UnitsScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  // A short seeded list (ADR 0028): `reference`.
  const units = useApiAllPages(
    'listUnitsOfMeasure',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('units.loading'),
    emptyTitle: t('units.empty'),
    emptyDescription: t('units.emptyBody'),
    errorTitle: t('units.error'),
    deniedTitle: t('units.denied'),
  });
  const columns: TableColumn<Unit>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('units.columns.name'),
      sortValue: (unit) => unit.name,
      cell: (unit) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Ruler} tone="slate" size="sm" />
          <span className="grid min-w-0">
            <span>{unit.name}</span>
            <code className="text-control-sm font-normal text-fg-muted">{unit.code}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'kind',
      head: t('units.columns.kind'),
      sortValue: (unit) => t(`uomKind.${unit.kind}`),
      cell: (unit) => t(`uomKind.${unit.kind}`),
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="units-title" className="grid gap-4">
      <PageHeader title={t('units.title')} titleId="units-title" />
      <p className="text-fg-muted">{t('units.intro')}</p>
      <TableCard
        view={view}
        query={units}
        labels={labels}
        rows={(all) => all.items}
        rowKey={(unit) => unit.code}
        tableLabel={t('units.table')}
        exportName={t('units.title')}
      />
    </section>
  );
}
