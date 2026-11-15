import { useTranslation } from 'react-i18next';
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
  PageHeader,
} from '@hakorem/ui';
import { useApiAllPages } from '../data/api';
import { useStateLabels } from '../lib/states';

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
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('units.columns.name')}</TableHead>
        <TableHead>{t('units.columns.code')}</TableHead>
        <TableHead>{t('units.columns.kind')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="units-title" className="grid gap-4">
      <PageHeader title={t('units.title')} titleId="units-title" />
      <p className="text-fg-muted">{t('units.intro')}</p>
      <QueryBoundary
        query={units}
        labels={labels}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('units.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={3} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(all) => (
          <TableContainer aria-label={t('units.table')}>
            <Table>
              {header}
              <TableBody>
                {all.items.map((unit) => (
                  <TableRow key={unit.code}>
                    <TableRowHeader>{unit.name}</TableRowHeader>
                    <TableCell label={t('units.columns.code')}>
                      <code>{unit.code}</code>
                    </TableCell>
                    <TableCell label={t('units.columns.kind')}>
                      {t(`uomKind.${unit.kind}`)}
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
