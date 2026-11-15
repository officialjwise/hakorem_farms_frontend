import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Field,
  MoneyDisplay,
  NOT_APPLICABLE,
  Pagination,
  PriceBandDisplay,
  QuantityDisplay,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  WeightDisplay,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from './locations';
import { asPlaces, useUnits } from './units';

const ALL = 'ALL';
const COLUMNS = 7;

/**
 * FR-INV stock on hand, derived by the API from the movement ledger. Cost and selling price are separate
 * columns (CR-001), and the total at cost is the API's own figure for every matching line, not a sum of
 * this page (DATA_CONVENTIONS: totals come from the API).
 */
export function StockOnHandScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const locations = useLocations();
  const pages = useCursorPages();
  const [locationId, setLocationId] = useState(ALL);
  // Stock is acted on: `live`, the default.
  const stock = useApiQuery('listStockOnHand', {
    query: {
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
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('onHand.columns.product')}</TableHead>
        <TableHead>{t('onHand.columns.location')}</TableHead>
        <TableHead numeric>{t('onHand.columns.onHand')}</TableHead>
        <TableHead numeric>{t('onHand.columns.available')}</TableHead>
        <TableHead numeric>{t('onHand.columns.cost')}</TableHead>
        <TableHead numeric>{t('onHand.columns.value')}</TableHead>
        <TableHead>{t('onHand.columns.price')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="on-hand-title" className="grid gap-4">
      <h1 id="on-hand-title" className="text-2xl font-semibold">
        {t('onHand.title')}
      </h1>
      <div className="max-w-xs">
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
      </div>
      <QueryBoundary
        query={stock}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('onHand.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={COLUMNS} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <div className="grid gap-1 rounded-md border border-border p-3">
              <p className="text-fg-muted">{t('onHand.total')}</p>
              <p className="text-xl">
                <MoneyDisplay pesewas={page.totalValueAtCostPesewas} strong />
              </p>
              <p className="text-control-sm text-fg-muted">
                {t('onHand.asOf')} <When instant={page.asOf} /> · {t('common:time.zone')}
              </p>
            </div>
            <TableContainer aria-label={t('onHand.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((line, index) => {
                    const unit = units.name(line.uom);
                    // The line carries its unit's precision (CR-003, contract 1.16.0).
                    const places = asPlaces(line.uomDisplayDecimals);
                    return (
                      <TableRow
                        key={`${line.product.id}-${line.location.id}-${line.stockUnit?.id ?? ''}-${index}`}
                      >
                        <TableRowHeader>
                          <span className="grid">
                            <span>{line.product.name}</span>
                            {line.stockUnit === null ? null : (
                              <code className="text-control-sm">{line.stockUnit.identifier}</code>
                            )}
                            {line.expiresOn === null ? null : (
                              <span className="text-control-sm text-fg-muted">
                                {t('onHand.expires', { date: line.expiresOn })}
                              </span>
                            )}
                          </span>
                        </TableRowHeader>
                        <TableCell label={t('onHand.columns.location')}>
                          {line.location.name}
                        </TableCell>
                        <TableCell numeric label={t('onHand.columns.onHand')}>
                          <span className="grid justify-items-end">
                            <QuantityDisplay
                              quantity={line.onHandQty}
                              unit={unit}
                              places={places}
                            />
                            {line.onHandWeightKg === null ? null : (
                              <WeightDisplay kilograms={line.onHandWeightKg} />
                            )}
                          </span>
                        </TableCell>
                        <TableCell numeric label={t('onHand.columns.available')}>
                          <QuantityDisplay
                            quantity={line.availableQty}
                            unit={unit}
                            places={places}
                          />
                        </TableCell>
                        <TableCell numeric label={t('onHand.columns.cost')}>
                          <span className="grid justify-items-end">
                            <MoneyDisplay pesewas={line.unitCostPesewas} />
                            <span className="text-control-sm text-fg-muted">
                              {t(`valuation.${line.valuationMethod}`)}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell numeric label={t('onHand.columns.value')}>
                          <MoneyDisplay pesewas={line.valueAtCostPesewas} />
                        </TableCell>
                        <TableCell label={t('onHand.columns.price')}>
                          {line.priceBand === null ? (
                            NOT_APPLICABLE
                          ) : (
                            <PriceBandDisplay
                              band={line.priceBand}
                              basisLabel={t(`basis.${line.priceBand.basis}`)}
                              toLabel={t('onHand.to')}
                              listPriceLabel={t('onHand.listPrice')}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('onHand.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}
