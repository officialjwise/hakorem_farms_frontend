import { CalendarClock, CircleCheck, CircleSlash, CircleX, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Field,
  MoneyDisplay,
  NOT_APPLICABLE,
  QuantityDisplay,
  Select,
  StatusBadge,
  WeightDisplay,
} from '@hakorem/ui';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { lookup, UNKNOWN } from '../lib/lookup';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from '../stock/locations';
import { asPlaces, useUnits } from '../stock/units';
import { RecordList } from './RecordList';

type S = components['schemas'];

const UNIT_STATUS = {
  ACTIVE: { tone: 'good', icon: CircleCheck },
  SOLD: { tone: 'slate', icon: CircleSlash },
  CONSUMED: { tone: 'slate', icon: CircleSlash },
  WRITTEN_OFF: { tone: 'critical', icon: CircleX },
  DEPLETED: { tone: 'slate', icon: CircleSlash },
} as const;

const EXPIRY = ['ALL', '7', '30'] as const;

/** A movement type code in words: SALE_ISSUE reads "Sale issue". The codes are the API's own. */
function humanise(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Lots and expiry (batch management and expiry tracking, F5b): every lot and individual animal, where it
 * is, and when it expires, filtered to those expiring soon. The expiry window is the API's filter
 * (`expiringWithinDays`); this screen compares no dates.
 */
export function LotsScreen() {
  const { t } = useTranslation(['lists', 'common']);
  const pages = useCursorPages();
  const locations = useLocations();
  const [locationId, setLocationId] = useState('ALL');
  const [within, setWithin] = useState<(typeof EXPIRY)[number]>('ALL');
  // Lots on hand are acted on: `live`.
  const lots = useApiQuery('listStockUnits', {
    query: {
      status: 'ACTIVE',
      ...(locationId === 'ALL' ? {} : { locationId }),
      ...(within === 'ALL' ? {} : { expiringWithinDays: Number(within) }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  return (
    <RecordList<S['StockUnit']>
      id="lots-title"
      title={t('lots.title')}
      description={
        <span className="grid">
          {t('lots.description')}
          <BranchScopeNote />
        </span>
      }
      words={{
        loading: t('lots.loading'),
        emptyTitle: t('lots.empty'),
        emptyDescription: t('lots.emptyBody'),
        errorTitle: t('lots.error'),
        deniedTitle: t('lots.denied'),
      }}
      query={lots}
      pages={pages}
      filters={
        <>
          <div className="w-full max-w-xs">
            <Field label={t('lots.location')}>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  pages.reset();
                }}
                options={[{ value: 'ALL', label: t('lots.allLocations') }, ...locations.options]}
              />
            </Field>
          </div>
          <div className="w-full max-w-xs">
            <Field label={t('lots.expiring')}>
              <Select
                value={within}
                onValueChange={(value) => {
                  setWithin(value as (typeof EXPIRY)[number]);
                  pages.reset();
                }}
                options={EXPIRY.map((value) => ({ value, label: t(`lots.within.${value}`) }))}
              />
            </Field>
          </div>
        </>
      }
      rowKey={(lot) => lot.id}
      nameHead={t('lots.columns.lot')}
      name={(lot) => (
        <span className="grid">
          <span>{lot.product.name}</span>
          <code className="text-control-sm text-fg-muted">{lot.identifier}</code>
        </span>
      )}
      columns={[
        {
          head: t('lots.columns.where'),
          cell: (lot) => lot.currentLocation?.name ?? NOT_APPLICABLE,
        },
        {
          head: t('lots.columns.expires'),
          cell: (lot) =>
            lot.expiresOn === null ? (
              NOT_APPLICABLE
            ) : (
              <span className="inline-flex items-center gap-1">
                <CalendarClock aria-hidden="true" className="size-icon-sm stroke-clay" />
                {lot.expiresOn}
              </span>
            ),
        },
        {
          head: t('lots.columns.onHand'),
          numeric: true,
          cell: (lot) => (
            <span className="grid justify-items-end">
              <QuantityDisplay
                quantity={lot.onHandQty}
                unit={lot.uom}
                places={asPlaces(lot.uomDisplayDecimals)}
              />
              {lot.lastWeightKg === null ? null : <WeightDisplay kilograms={lot.lastWeightKg} />}
            </span>
          ),
        },
        {
          head: t('lots.columns.value'),
          numeric: true,
          cell: (lot) => <MoneyDisplay pesewas={lot.valueAtCostPesewas} />,
        },
        {
          head: t('lots.columns.status'),
          cell: (lot) => {
            const look = lookup(UNIT_STATUS, lot.status, UNKNOWN);
            return (
              <span className="flex flex-wrap gap-1">
                <StatusBadge
                  tone={look.tone}
                  icon={look.icon}
                  label={t(`lots.status.${lot.status}`, { defaultValue: lot.status })}
                />
                {lot.activeHolds.length > 0 ? (
                  <StatusBadge tone="plum" icon={Hourglass} label={t('lots.onHold')} />
                ) : null}
              </span>
            );
          },
        },
      ]}
      tableLabel={t('lots.table')}
      pagesLabel={t('lots.pages')}
    />
  );
}

/** Stock movements (the inventory log, FR-INV): the append-only ledger, newest first, as the API keeps it. */
export function MovementsScreen() {
  const { t } = useTranslation(['lists', 'common']);
  const pages = useCursorPages();
  const units = useUnits();
  const locations = useLocations();
  const [locationId, setLocationId] = useState('ALL');
  // A ledger read to answer a question, not acted on: `working`.
  const movements = useApiQuery(
    'listStockMovements',
    {
      query: {
        ...(locationId === 'ALL' ? {} : { locationId }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );
  return (
    <RecordList<S['StockMovement']>
      id="movements-title"
      title={t('movements.title')}
      description={
        <span className="grid">
          {t('movements.description')}
          <BranchScopeNote />
        </span>
      }
      words={{
        loading: t('movements.loading'),
        emptyTitle: t('movements.empty'),
        errorTitle: t('movements.error'),
        deniedTitle: t('movements.denied'),
      }}
      query={movements}
      pages={pages}
      filters={
        <div className="w-full max-w-xs">
          <Field label={t('movements.location')}>
            <Select
              value={locationId}
              onValueChange={(value) => {
                setLocationId(value);
                pages.reset();
              }}
              options={[{ value: 'ALL', label: t('movements.allLocations') }, ...locations.options]}
            />
          </Field>
        </div>
      }
      rowKey={(movement) => movement.id}
      nameHead={t('movements.columns.what')}
      name={(movement) => (
        <span className="grid">
          <span>{movement.product.name}</span>
          <span className="text-control-sm text-fg-muted">
            {humanise(movement.movementType)}
            {movement.stockUnit === null ? '' : ` · ${movement.stockUnit.identifier}`}
          </span>
        </span>
      )}
      columns={[
        {
          head: t('movements.columns.when'),
          cell: (movement) => <When instant={movement.occurredAt} />,
        },
        {
          head: t('movements.columns.route'),
          cell: (movement) =>
            t('movements.route', { from: movement.from.name, to: movement.to.name }),
        },
        {
          head: t('movements.columns.qty'),
          numeric: true,
          cell: (movement) => (
            <QuantityDisplay
              quantity={movement.qty}
              unit={units.name(movement.uom)}
              places={units.places(movement.uom)}
            />
          ),
        },
        {
          head: t('movements.columns.value'),
          numeric: true,
          cell: (movement) => <MoneyDisplay pesewas={movement.valuePesewas} />,
        },
        {
          head: t('movements.columns.source'),
          cell: (movement) => movement.sourceDocument.number ?? movement.sourceDocument.docType,
        },
        {
          head: t('movements.columns.by'),
          cell: (movement) => movement.actor.displayName,
        },
      ]}
      tableLabel={t('movements.table')}
      pagesLabel={t('movements.pages')}
    />
  );
}

/** Suppliers (FR-PUR register, read only until the procurement session). */
export function SuppliersScreen() {
  const { t } = useTranslation(['lists', 'common']);
  const pages = useCursorPages();
  // A list people browse: `working`.
  const suppliers = useApiQuery(
    'listSuppliers',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'working' },
  );
  return (
    <RecordList<S['Supplier']>
      id="suppliers-title"
      title={t('suppliers.title')}
      description={t('suppliers.description')}
      words={{
        loading: t('suppliers.loading'),
        emptyTitle: t('suppliers.empty'),
        errorTitle: t('suppliers.error'),
        deniedTitle: t('suppliers.denied'),
      }}
      query={suppliers}
      pages={pages}
      rowKey={(supplier) => supplier.id}
      nameHead={t('suppliers.columns.supplier')}
      name={(supplier) => (
        <span className="grid">
          <span>{supplier.name}</span>
          <code className="text-control-sm text-fg-muted">{supplier.supplierNo}</code>
        </span>
      )}
      columns={[
        {
          head: t('suppliers.columns.contact'),
          cell: (supplier) =>
            [supplier.contactName, supplier.phone, supplier.email]
              .filter((value) => value !== null && value !== '')
              .join(' · ') || NOT_APPLICABLE,
        },
        {
          head: t('suppliers.columns.status'),
          cell: (supplier) =>
            supplier.status === 'ACTIVE' ? (
              <StatusBadge tone="good" icon={CircleCheck} label={t('suppliers.status.ACTIVE')} />
            ) : (
              <StatusBadge
                tone="critical"
                icon={CircleX}
                label={t(`suppliers.status.${supplier.status}`, { defaultValue: supplier.status })}
              />
            ),
        },
      ]}
      tableLabel={t('suppliers.table')}
      pagesLabel={t('suppliers.pages')}
    />
  );
}

/** Cash registers (FR-POS): each till, where it is, and whether a shift is open on it now. */
export function RegistersScreen() {
  const { t } = useTranslation(['lists', 'common']);
  const pages = useCursorPages();
  const scope = useBranchScope();
  // Whether a till is open is acted on: `live`.
  const registers = useApiQuery('listRegisters', {
    query: { ...scope.query, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) },
  });
  return (
    <RecordList<S['Register']>
      id="registers-title"
      title={t('registers.title')}
      description={t('registers.description')}
      words={{
        loading: t('registers.loading'),
        emptyTitle: t('registers.empty'),
        errorTitle: t('registers.error'),
        deniedTitle: t('registers.denied'),
      }}
      query={registers}
      pages={pages}
      rowKey={(register) => register.id}
      nameHead={t('registers.columns.register')}
      name={(register) => (
        <span className="grid">
          <span>{register.name}</span>
          <code className="text-control-sm text-fg-muted">{register.code}</code>
        </span>
      )}
      columns={[
        { head: t('registers.columns.where'), cell: (register) => register.location.name },
        {
          head: t('registers.columns.shift'),
          cell: (register) =>
            register.openShift === null ? (
              <StatusBadge tone="slate" icon={CircleSlash} label={t('registers.closed')} />
            ) : (
              <span className="grid">
                <StatusBadge tone="good" icon={CircleCheck} label={t('registers.open')} />
                <span className="text-control-sm text-fg-muted">
                  {register.openShift.cashier.displayName} ·{' '}
                  <When instant={register.openShift.openedAt} />
                </span>
              </span>
            ),
        },
        { head: t('registers.columns.devices'), numeric: true, cell: (r) => r.deviceCount },
      ]}
      tableLabel={t('registers.table')}
      pagesLabel={t('registers.pages')}
    />
  );
}
