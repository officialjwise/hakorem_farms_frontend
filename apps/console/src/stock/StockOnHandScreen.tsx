import { Package, PawPrint } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Field,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  NOT_APPLICABLE,
  PriceBandDisplay,
  QuantityDisplay,
  Select,
  useTableView,
  WeightDisplay,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from './locations';
import { asPlaces, useUnits } from './units';

type Line = components['schemas']['StockOnHandLine'];

const ALL = 'ALL';

/**
 * FR-INV stock on hand, derived by the API from the movement ledger. Cost and selling price are separate
 * columns (CR-001), and the total at cost is the API's own figure for every matching line, not a sum of
 * this page (DATA_CONVENTIONS: totals come from the API).
 */
export function StockOnHandScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const scope = useBranchScope();
  const locations = useLocations();
  const pages = useCursorPages();
  const [locationId, setLocationId] = useState(ALL);
  // Stock is acted on: `live`, the default.
  const stock = useApiQuery('listStockOnHand', {
    query: {
      ...scope.query,
      ...(locationId === ALL ? {} : { locationId }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('onHand.loading'),
    emptyTitle: t('onHand.empty'),
    emptyDescription: t('onHand.emptyBody'),
    errorTitle: t('onHand.error'),
    deniedTitle: t('onHand.denied'),
  });
  // Quantities are in each line's own unit, so they are shown, never compared: only the API's single
  // figures (names, integer pesewas) sort.
  const columns: TableColumn<Line>[] = [
    {
      id: 'product',
      rowHeader: true,
      head: t('onHand.columns.product'),
      sortValue: (line) => line.product.name,
      cell: (line) => {
        const animal = line.stockUnit?.tracking === 'SERIAL';
        return (
          <span className="flex items-center gap-3">
            <IconChip
              icon={animal ? PawPrint : Package}
              tone={animal ? 'accent' : 'sand'}
              size="sm"
            />
            <span className="grid min-w-0">
              <span>{line.product.name}</span>
              <code className="text-control-sm font-normal text-fg-muted">
                {line.stockUnit?.identifier ?? line.product.sku}
              </code>
              {line.expiresOn === null ? null : (
                <span className="text-control-sm font-normal text-fg-muted">
                  {t('onHand.expires', { date: line.expiresOn })}
                </span>
              )}
            </span>
          </span>
        );
      },
    },
    {
      id: 'location',
      head: t('onHand.columns.location'),
      sortValue: (line) => line.location.name,
      cell: (line) => line.location.name,
    },
    {
      id: 'onHand',
      head: t('onHand.columns.onHand'),
      numeric: true,
      cell: (line) => (
        <span className="grid justify-items-end">
          <QuantityDisplay
            quantity={line.onHandQty}
            unit={units.name(line.uom)}
            // The line carries its unit's precision (CR-003, contract 1.16.0).
            places={asPlaces(line.uomDisplayDecimals)}
          />
          {line.onHandWeightKg === null ? null : <WeightDisplay kilograms={line.onHandWeightKg} />}
        </span>
      ),
    },
    {
      id: 'available',
      head: t('onHand.columns.available'),
      numeric: true,
      cell: (line) => (
        <QuantityDisplay
          quantity={line.availableQty}
          unit={units.name(line.uom)}
          places={asPlaces(line.uomDisplayDecimals)}
        />
      ),
    },
    {
      id: 'cost',
      head: t('onHand.columns.cost'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (line) => line.unitCostPesewas,
      cell: (line) => (
        <span className="grid justify-items-end">
          <MoneyDisplay pesewas={line.unitCostPesewas} />
          <span className="text-control-sm text-fg-muted">
            {t(`valuation.${line.valuationMethod}`)}
          </span>
        </span>
      ),
    },
    {
      id: 'value',
      head: t('onHand.columns.value'),
      numeric: true,
      sortValue: (line) => line.valueAtCostPesewas,
      cell: (line) => <MoneyDisplay pesewas={line.valueAtCostPesewas} />,
    },
    {
      id: 'price',
      head: t('onHand.columns.price'),
      cell: (line) =>
        line.priceBand === null ? (
          NOT_APPLICABLE
        ) : (
          <PriceBandDisplay
            band={line.priceBand}
            basisLabel={t(`basis.${line.priceBand.basis}`)}
            toLabel={t('onHand.to')}
            listPriceLabel={t('onHand.listPrice')}
          />
        ),
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="on-hand-title" className="grid gap-4">
      <PageHeader title={t('onHand.title')} titleId="on-hand-title" />
      <TableCard
        view={view}
        query={stock}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(line, index) =>
          `${line.product.id}-${line.location.id}-${line.stockUnit?.id ?? ''}-${index}`
        }
        tableLabel={t('onHand.table')}
        exportName={t('onHand.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('onHand.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={locationId === ALL ? 0 : 1}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setLocationId(ALL);
                pages.reset();
              },
            }}
          >
            <Field label={t('onHand.location')}>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  pages.reset();
                }}
                options={[{ value: ALL, label: t('onHand.allLocations') }, ...locations.options]}
              />
            </Field>
          </FilterMenu>
        }
        // The API's total for every line this filter matches, not a sum of this page.
        footer={(page) => (
          <div className="grid gap-1 border-t border-border p-4">
            <p className="text-fg-muted">{t('onHand.total')}</p>
            <p className="text-xl">
              <MoneyDisplay pesewas={page.totalValueAtCostPesewas} strong />
            </p>
            <p className="text-control-sm text-fg-muted">
              {t('onHand.asOf')} <When instant={page.asOf} /> · {t('common:time.zone')}
            </p>
          </div>
        )}
      />
    </section>
  );
}
