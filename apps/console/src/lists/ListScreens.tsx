import {
  ArrowLeftRight,
  CalendarClock,
  CircleCheck,
  CircleSlash,
  CircleX,
  Hourglass,
  Monitor,
  Package,
  PawPrint,
  Truck,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { documentHref } from '../lib/documents';
import type { components } from '@hakorem/api-client';
import {
  DateRangeMenu,
  Field,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  NOT_APPLICABLE,
  QuantityDisplay,
  Select,
  StatusBadge,
  ToolbarSearch,
  WeightDisplay,
  type IconChipTone,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { dayEnd, dayStart, useDateRangeWords, type DateRange } from '../lib/dateRange';
import { lookup, UNKNOWN } from '../lib/lookup';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from '../stock/locations';
import { asPlaces, useUnits } from '../stock/units';
import { RecordList } from './RecordList';
import { ReadableId } from '../lib/ReadableId';

type S = components['schemas'];

const UNIT_STATUS = {
  ACTIVE: { tone: 'good', icon: CircleCheck },
  SOLD: { tone: 'slate', icon: CircleSlash },
  CONSUMED: { tone: 'slate', icon: CircleSlash },
  WRITTEN_OFF: { tone: 'critical', icon: CircleX },
  DEPLETED: { tone: 'slate', icon: CircleSlash },
} as const;

const EXPIRY = ['ALL', '7', '30'] as const;
const SUPPLIER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;

/** A movement type code in words: SALE_ISSUE reads "Sale issue". The codes are the API's own. */
function humanise(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A row's name with its icon chip and its code beneath, as the reference lists a row without an image. */
function NameCell({
  icon,
  tone,
  name,
  code,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: IconChipTone;
  name: ReactNode;
  code: ReactNode;
}) {
  return (
    <span className="flex items-center gap-3">
      <IconChip icon={icon} tone={tone} size="sm" />
      <span className="grid min-w-0">
        <span>{name}</span>
        <span className="text-control-sm font-normal text-fg-muted">{code}</span>
      </span>
    </span>
  );
}

/** The toolbar's search: typed words are sent with Enter, and a new search starts at the first page. */
function useSearch(onSearch: () => void) {
  // A link can open a list already searched (`/lots?q=PRC-…`, from a processing order's output, F6).
  const [params] = useSearchParams();
  const [typed, setTyped] = useState(() => params.get('q') ?? '');
  const [q, setQ] = useState(() => (params.get('q') ?? '').trim());
  return {
    q,
    props: {
      value: typed,
      onValueChange: setTyped,
      onSubmit: (value: string) => {
        setQ(value);
        onSearch();
      },
    },
  };
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
  const search = useSearch(pages.reset);
  const [locationId, setLocationId] = useState('ALL');
  const [within, setWithin] = useState<(typeof EXPIRY)[number]>('ALL');
  // Lots on hand are acted on: `live`.
  const lots = useApiQuery('listStockUnits', {
    query: {
      status: 'ACTIVE',
      ...(search.q === '' ? {} : { q: search.q }),
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
      toolbar={
        <>
          <ToolbarSearch label={t('lots.search')} {...search.props} />
          <FilterMenu
            label={t('common:table.filter')}
            active={(locationId === 'ALL' ? 0 : 1) + (within === 'ALL' ? 0 : 1)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setLocationId('ALL');
                setWithin('ALL');
                pages.reset();
              },
            }}
          >
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
            <Field label={t('lots.expiring')}>
              <Select
                value={within}
                onValueChange={(value) => {
                  setWithin(EXPIRY.find((option) => option === value) ?? 'ALL');
                  pages.reset();
                }}
                options={EXPIRY.map((value) => ({ value, label: t(`lots.within.${value}`) }))}
              />
            </Field>
          </FilterMenu>
        </>
      }
      rowKey={(lot) => lot.id}
      columns={[
        {
          id: 'lot',
          rowHeader: true,
          head: t('lots.columns.lot'),
          sortValue: (lot) => lot.product.name,
          cell: (lot) => (
            <NameCell
              icon={lot.tracking === 'SERIAL' ? PawPrint : Package}
              tone={lot.tracking === 'SERIAL' ? 'accent' : 'sand'}
              name={lot.product.name}
              code={<code>{lot.identifier}</code>}
            />
          ),
        },
        {
          // Where the lot came from, as a link: a meat lot opens its processing order, whose inputs open the
          // animal it was cut from (the brief's B6/F6 trace: a lot to its animal in a few clicks).
          id: 'source',
          head: t('lots.columns.source'),
          sortValue: (lot) => lot.sourceDocument.number ?? lot.sourceDocument.docType,
          cell: (lot) => {
            const href = documentHref(lot.sourceDocument);
            const words =
              lot.sourceDocument.number ??
              t(`lots.sourceKind.${lot.sourceDocument.docType}`, {
                defaultValue: lot.sourceDocument.docType,
              });
            return href === undefined ? (
              words
            ) : (
              <Link to={href} className="text-accent-text underline">
                {words}
              </Link>
            );
          },
        },
        {
          id: 'where',
          head: t('lots.columns.where'),
          sortValue: (lot) => lot.currentLocation?.name,
          cell: (lot) => lot.currentLocation?.name ?? NOT_APPLICABLE,
        },
        {
          id: 'expires',
          head: t('lots.columns.expires'),
          // ISO dates sort as text.
          sortValue: (lot) => lot.expiresOn,
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
          id: 'onHand',
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
          id: 'value',
          head: t('lots.columns.value'),
          numeric: true,
          // The API's integer pesewas, compared, never added.
          sortValue: (lot) => lot.valueAtCostPesewas,
          cell: (lot) => <MoneyDisplay pesewas={lot.valueAtCostPesewas} />,
        },
        {
          id: 'status',
          head: t('lots.columns.status'),
          cell: (lot) => {
            const look = lookup(UNIT_STATUS, lot.status, UNKNOWN);
            return (
              <span className="flex flex-wrap gap-1">
                <StatusBadge
                  tone={look.tone}
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
  const rangeWords = useDateRangeWords();
  const [locationId, setLocationId] = useState('ALL');
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  // A ledger read to answer a question, not acted on: `working`.
  const movements = useApiQuery(
    'listStockMovements',
    {
      query: {
        ...(locationId === 'ALL' ? {} : { locationId }),
        ...(range.from === undefined ? {} : { from: dayStart(range.from) }),
        ...(range.to === undefined ? {} : { to: dayEnd(range.to) }),
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
      toolbar={
        <>
          <DateRangeMenu
            label={t('movements.dates')}
            summary={rangeWords(range)}
            from={range.from}
            to={range.to}
            onChange={(next) => {
              setRange(next);
              pages.reset();
            }}
            fromLabel={t('common:dates.from')}
            toLabel={t('common:dates.to')}
            clearLabel={t('common:dates.clear')}
          />
          <FilterMenu
            label={t('common:table.filter')}
            active={locationId === 'ALL' ? 0 : 1}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setLocationId('ALL');
                pages.reset();
              },
            }}
          >
            <Field label={t('movements.location')}>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  pages.reset();
                }}
                options={[
                  { value: 'ALL', label: t('movements.allLocations') },
                  ...locations.options,
                ]}
              />
            </Field>
          </FilterMenu>
        </>
      }
      rowKey={(movement) => movement.id}
      columns={[
        {
          id: 'what',
          rowHeader: true,
          head: t('movements.columns.what'),
          sortValue: (movement) => movement.product.name,
          cell: (movement) => (
            <NameCell
              icon={ArrowLeftRight}
              tone="accent"
              name={movement.product.name}
              code={
                <>
                  {humanise(movement.movementType)}
                  {movement.stockUnit === null ? '' : ` · ${movement.stockUnit.identifier}`}
                </>
              }
            />
          ),
        },
        {
          id: 'when',
          head: t('movements.columns.when'),
          // ISO instants sort as text.
          sortValue: (movement) => movement.occurredAt,
          cell: (movement) => <When instant={movement.occurredAt} />,
        },
        {
          id: 'route',
          head: t('movements.columns.route'),
          cell: (movement) =>
            t('movements.route', { from: movement.from.name, to: movement.to.name }),
        },
        {
          id: 'qty',
          head: t('movements.columns.qty'),
          numeric: true,
          cell: (movement) => (
            <QuantityDisplay
              quantity={movement.qty}
              unit={units.after(movement.uom, movement.qty)}
              places={units.places(movement.uom)}
            />
          ),
        },
        {
          id: 'value',
          head: t('movements.columns.value'),
          numeric: true,
          sortValue: (movement) => movement.valuePesewas,
          cell: (movement) => <MoneyDisplay pesewas={movement.valuePesewas} />,
        },
        {
          id: 'source',
          head: t('movements.columns.source'),
          sortValue: (movement) =>
            movement.sourceDocument.number ?? movement.sourceDocument.docType,
          cell: (movement) => movement.sourceDocument.number ?? movement.sourceDocument.docType,
        },
        {
          id: 'by',
          head: t('movements.columns.by'),
          sortValue: (movement) => movement.actor.displayName,
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
  // F10g: a supplier's account (what is owed, claimed and paid) for those who read its invoices.
  const canSeeAccounts = useAuth().can('pur.supplier_invoice.read');
  const pages = useCursorPages();
  const search = useSearch(pages.reset);
  const [status, setStatus] = useState<(typeof SUPPLIER_STATUSES)[number] | 'ALL'>('ALL');
  // A list people browse: `working`.
  const suppliers = useApiQuery(
    'listSuppliers',
    {
      query: {
        ...(search.q === '' ? {} : { q: search.q }),
        ...(status === 'ALL' ? {} : { status }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
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
      toolbar={
        <>
          <ToolbarSearch label={t('suppliers.search')} {...search.props} />
          <FilterMenu
            label={t('common:table.filter')}
            active={status === 'ALL' ? 0 : 1}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus('ALL');
                pages.reset();
              },
            }}
          >
            <Field label={t('suppliers.statusFilter')}>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(SUPPLIER_STATUSES.find((s) => s === value) ?? 'ALL');
                  pages.reset();
                }}
                options={[
                  { value: 'ALL', label: t('suppliers.allStatuses') },
                  ...SUPPLIER_STATUSES.map((s) => ({
                    value: s,
                    label: t(`suppliers.status.${s}`),
                  })),
                ]}
              />
            </Field>
          </FilterMenu>
        </>
      }
      rowKey={(supplier) => supplier.id}
      columns={[
        {
          id: 'supplier',
          rowHeader: true,
          head: t('suppliers.columns.supplier'),
          sortValue: (supplier) => supplier.name,
          cell: (supplier) => (
            <NameCell
              icon={Truck}
              tone="info"
              name={supplier.name}
              code={<ReadableId value={supplier.publicId} />}
            />
          ),
        },
        {
          id: 'contact',
          head: t('suppliers.columns.contact'),
          sortValue: (supplier) => supplier.contactName,
          cell: (supplier) =>
            [supplier.contactName, supplier.phone, supplier.email]
              .filter((value) => value !== null && value !== '')
              .join(' · ') || NOT_APPLICABLE,
        },
        {
          id: 'status',
          head: t('suppliers.columns.status'),
          sortValue: (supplier) => supplier.status,
          cell: (supplier) =>
            supplier.status === 'ACTIVE' ? (
              <StatusBadge tone="good" label={t('suppliers.status.ACTIVE')} />
            ) : (
              <StatusBadge
                tone="critical"
                label={t(`suppliers.status.${supplier.status}`, { defaultValue: supplier.status })}
              />
            ),
        },
        ...(canSeeAccounts
          ? [
              {
                id: 'account',
                head: t('suppliers.columns.account'),
                cell: (supplier: S['Supplier']) => (
                  <Link to={`/suppliers/${supplier.id}`} className="text-accent-text underline">
                    {t('suppliers.openAccount', { supplier: supplier.name })}
                  </Link>
                ),
              },
            ]
          : []),
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
      columns={[
        {
          id: 'register',
          rowHeader: true,
          head: t('registers.columns.register'),
          sortValue: (register) => register.name,
          cell: (register) => (
            <NameCell
              icon={Monitor}
              tone="accent"
              name={register.name}
              code={<code>{register.code}</code>}
            />
          ),
        },
        {
          id: 'where',
          head: t('registers.columns.where'),
          sortValue: (register) => register.location.name,
          cell: (register) => register.location.name,
        },
        {
          id: 'shift',
          head: t('registers.columns.shift'),
          sortValue: (register) => (register.openShift === null ? 1 : 0),
          cell: (register) =>
            register.openShift === null ? (
              <StatusBadge tone="slate" label={t('registers.closed')} />
            ) : (
              <span className="grid justify-items-start gap-1">
                <StatusBadge tone="good" label={t('registers.open')} />
                <span className="text-control-sm text-fg-muted">
                  {register.openShift.cashier.displayName} ·{' '}
                  <When instant={register.openShift.openedAt} />
                </span>
              </span>
            ),
        },
        {
          id: 'devices',
          head: t('registers.columns.devices'),
          numeric: true,
          sortValue: (register) => register.deviceCount,
          cell: (register) => register.deviceCount,
        },
      ]}
      tableLabel={t('registers.table')}
      pagesLabel={t('registers.pages')}
    />
  );
}
