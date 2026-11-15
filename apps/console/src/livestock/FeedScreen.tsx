import { PencilLine, Plus, Wheat } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  AnimalTag,
  Button,
  DatePicker,
  DateRangeMenu,
  Dialog,
  DialogActions,
  Field,
  FilterMenu,
  formatQuantity,
  Input,
  MoneyDisplay,
  MutationFailure,
  NumberInput,
  QuantityDisplay,
  QueryBoundary,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { newRecordId } from '../lib/clientId';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { uniqueById, useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ProductPicker, type ProductRef } from '../stock/LinesEditor';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useLocations } from '../stock/locations';
import { toQuantity, useUnits } from '../stock/units';
import { useSpeciesOptions } from './animals';
import { rangeQuery } from './range';

type S = components['schemas'];
type FeedConsumption = S['FeedConsumption'];
type Ration = S['Ration'];

/**
 * FR-LIV feed: what each pen was fed and what it cost (valued and spread over the animals by the API, by
 * head-days), and the rations each species is fed on. Feeding a pen moves feed out of the store and puts
 * its cost on the animals, so it is confirmed with the exact quantity first.
 */
export function FeedScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const [tab, setTab] = useState('given');
  return (
    <section aria-labelledby="feed-title" className="grid gap-4">
      <PageHeader
        title={t('feed.title')}
        titleId="feed-title"
        description={t('feed.description')}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('feed.tabs')}>
          <TabsTrigger value="given">{t('feed.given')}</TabsTrigger>
          <TabsTrigger value="rations">{t('feed.rations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="given">
          <FeedGiven canRecord={auth.can('liv.feed.record')} />
        </TabsContent>
        <TabsContent value="rations">
          <Rations canManage={auth.can('liv.feed.manage')} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function FeedGiven({ canRecord }: { canRecord: boolean }) {
  const { t } = useTranslation(['livestock', 'common']);
  const units = useUnits();
  const pages = useCursorPages();
  const locations = useLocations();
  const rangeWords = useDateRangeWords();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [locationId, setLocationId] = useState(ANY);
  const [recording, setRecording] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const feed = useApiQuery('listFeedConsumption', {
    query: {
      ...rangeQuery(range, 'date'),
      ...param('locationId', locationId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('feed.loading'),
    emptyTitle: t('feed.empty'),
    emptyDescription: t('feed.emptyBody'),
    errorTitle: t('feed.error'),
    deniedTitle: t('feed.denied'),
  });
  const columns: TableColumn<FeedConsumption>[] = [
    {
      id: 'pen',
      rowHeader: true,
      head: t('feed.columns.pen'),
      sortValue: (row) => row.location.name,
      cell: (row) => (
        <Button variant="ghost" size="sm" className="underline" onClick={() => setOpened(row.id)}>
          {t('feed.openRow', { pen: row.location.name, date: row.consumedOn })}
        </Button>
      ),
    },
    {
      id: 'feed',
      head: t('feed.columns.feed'),
      sortValue: (row) => row.feedProduct.name,
      cell: (row) => (
        <span className="grid">
          <span>{row.feedProduct.name}</span>
          <span className="text-control-sm text-fg-muted">
            <QuantityDisplay
              quantity={row.qty}
              unit={units.name(row.uom)}
              places={units.places(row.uom)}
            />
          </span>
        </span>
      ),
    },
    {
      id: 'date',
      head: t('feed.columns.date'),
      sortValue: (row) => row.consumedOn,
      cell: (row) => row.consumedOn,
    },
    {
      id: 'status',
      head: t('feed.columns.status'),
      sortValue: (row) => row.status,
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'POSTED' ? 'good' : 'info'}
          label={t(`feedStatus.${row.status}`)}
        />
      ),
    },
    {
      id: 'value',
      head: t('feed.columns.value'),
      numeric: true,
      sortValue: (row) => row.valuePesewas ?? -1,
      cell: (row) =>
        row.valuePesewas === null ? (
          t('feed.notValued')
        ) : (
          <MoneyDisplay pesewas={row.valuePesewas} />
        ),
    },
  ];
  const view = useTableView(columns);
  return (
    <div className="grid gap-4 pt-4">
      {canRecord ? (
        <div>
          <Button onClick={() => setRecording(true)}>
            <Wheat aria-hidden="true" />
            {t('feed.record')}
          </Button>
        </div>
      ) : null}
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <TableCard
        view={view}
        query={feed}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('feed.table')}
        exportName={t('feed.given')}
        pages={{ state: pages, info: (page) => page.page, label: t('feed.pages') }}
        toolbar={
          <>
            <DateRangeMenu
              label={t('filters.dates')}
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
              active={countSet(locationId)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setLocationId(ANY);
                  pages.reset();
                },
              }}
            >
              <FilterSelect
                label={t('filters.location')}
                anyLabel={t('filters.anyLocation')}
                value={locationId}
                onChange={(value) => {
                  setLocationId(value);
                  pages.reset();
                }}
                options={locations.options}
              />
            </FilterMenu>
          </>
        }
      />
      {recording ? (
        <RecordFeedDialog
          onClose={() => setRecording(false)}
          onDone={(message) => {
            setRecording(false);
            setNotice(message);
          }}
        />
      ) : null}
      {opened === null ? null : <FeedDetail id={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}

/** One feed issue: how its cost was spread over the animals in the pen, as the API allocated it. */
function FeedDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(['livestock', 'common']);
  const units = useUnits();
  const issue = useApiQuery('getFeedConsumption', { path: { id } });
  const labels = useStateLabels({
    loading: t('feedDetail.loading'),
    emptyTitle: t('feedDetail.notFound'),
    errorTitle: t('feedDetail.error'),
    deniedTitle: t('feed.denied'),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('feedDetail.title')}
      closeLabel={t('common:actions.close')}
      icon={Wheat}
    >
      <QueryBoundary
        query={issue}
        labels={labels}
        isEmpty={() => false}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-32" />}
      >
        {(row) => (
          <div className="grid gap-3 pb-2 text-sm">
            <p>
              {t('feedDetail.summary', {
                qty: formatQuantity(row.qty, { places: units.places(row.uom) }),
                uom: units.name(row.uom),
                feed: row.feedProduct.name,
                pen: row.location.name,
                date: row.consumedOn,
              })}
            </p>
            <p className="text-fg-muted">
              {row.actor.displayName}
              {row.postedAt === null ? null : (
                <>
                  {' · '}
                  {t('feedDetail.posted')} <When instant={row.postedAt} />
                </>
              )}
            </p>
            {row.allocations.length === 0 ? (
              <p>{t('feedDetail.noAllocations')}</p>
            ) : (
              <>
                <TableContainer aria-label={t('feedDetail.allocations')}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('feedDetail.animal')}</TableHead>
                        <TableHead numeric>{t('feedDetail.headDays')}</TableHead>
                        <TableHead numeric>{t('feedDetail.amount')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.allocations.map((share) => (
                        <TableRow key={share.stockUnit.id}>
                          <TableRowHeader>
                            <span className="grid">
                              <AnimalTag tagNo={share.stockUnit.identifier} />
                              <span className="text-control-sm font-normal text-fg-muted">
                                {t(`treatment.${share.treatment}`)}
                              </span>
                            </span>
                          </TableRowHeader>
                          <TableCell numeric label={t('feedDetail.headDays')}>
                            {share.headDays}
                          </TableCell>
                          <TableCell numeric label={t('feedDetail.amount')}>
                            <MoneyDisplay pesewas={share.amountPesewas} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {row.valuePesewas === null ? null : (
                  <p className="flex justify-between font-semibold">
                    <span>{t('feedDetail.total')}</span>
                    <MoneyDisplay pesewas={row.valuePesewas} strong />
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </QueryBoundary>
    </Dialog>
  );
}

/** What a pen ate, from which store and on which ration, confirmed with the quantity before it is sent. */
export function RecordFeedDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const units = useUnits();
  const locations = useLocations();
  const [id] = useState(() => newRecordId());
  const [locationId, setLocationId] = useState('');
  const [feed, setFeed] = useState<ProductRef | null>(null);
  const [qty, setQty] = useState('');
  const [consumedOn, setConsumedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [rationId, setRationId] = useState(ANY);
  const [fromLocationId, setFrom] = useState(ANY);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const rations = useApiAllPages(
    'listRations',
    { query: { limit: 100 } },
    { staleClass: 'reference', enabled: auth.can('liv.feed.read') },
  );
  const record = useApiMutation('recordFeedConsumption');
  const keyFor = useIntentKey();
  const quantity = toQuantity(qty);
  const pen = locations.items.find((row) => row.id === locationId);
  const store = locations.items.find((row) => row.id === fromLocationId);
  const body = {
    id,
    locationId,
    feedProductId: feed?.id ?? '',
    qty: quantity ?? '',
    consumedOn,
    ...param('rationId', rationId),
    ...param('fromLocationId', fromLocationId),
  };
  if (confirming && feed !== null && quantity !== null) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(next) => (next ? undefined : setConfirming(false))}
        title={t('feedRecord.confirmTitle', { pen: pen?.name ?? '' })}
        body={t('feedRecord.confirmBody')}
        changes={[
          {
            label: feed.name,
            before: store?.name ?? t('feedRecord.defaultStore'),
            after: t('feedRecord.toPen', {
              qty: `${formatQuantity(quantity, { places: units.places(feed.baseUom) })} ${units.name(feed.baseUom)}`,
              pen: pen?.name ?? '',
            }),
          },
        ]}
        consequence={t('feedRecord.consequence')}
        confirmLabel={t('feedRecord.save')}
        pendingLabel={t('feedRecord.saving')}
        pending={record.isPending}
        error={record.error}
        failedTitle={t('feedRecord.failed')}
        icon={Wheat}
        confirmIcon={Wheat}
        onConfirm={() =>
          void record
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then((saved) =>
              onDone(
                saved.valuePesewas === null
                  ? t('feedRecord.done', { pen: saved.location.name })
                  : t('feedRecord.doneValued', { pen: saved.location.name }),
              ),
            )
            .catch(() => undefined)
        }
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('feedRecord.title')}
      description={t('feedRecord.body')}
      closeLabel={t('common:actions.cancel')}
      icon={Wheat}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const found: string[] = [];
          if (locationId === '') found.push('pen');
          if (feed === null) found.push('feed');
          if (quantity === null || /^0+\.0+$/.test(quantity)) found.push('qty');
          if (consumedOn === '') found.push('date');
          setProblems(found);
          if (found.length === 0) setConfirming(true);
        }}
      >
        <Field
          label={t('feedRecord.pen')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('pen') ? t('common:field.required') : undefined}
        >
          <Select
            value={locationId}
            onValueChange={setLocationId}
            placeholder={t('feedRecord.choosePen')}
            options={locations.options}
          />
        </Field>
        <ProductPicker
          label={t('feedRecord.feed')}
          value={feed}
          onChange={setFeed}
          error={problems.includes('feed') ? t('common:field.required') : undefined}
        />
        <Field
          label={t('feedRecord.qty')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          hint={t('feedRecord.qtyHint')}
          error={problems.includes('qty') ? t('feedRecord.qtyInvalid') : undefined}
        >
          <NumberInput value={qty} onValueChange={setQty} decimals={3} />
        </Field>
        <Field
          label={t('feedRecord.date')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('date') ? t('common:field.required') : undefined}
        >
          <DatePicker value={consumedOn} onChange={(event) => setConsumedOn(event.target.value)} />
        </Field>
        {auth.can('liv.feed.read') ? (
          <Field label={t('feedRecord.ration')}>
            <Select
              value={rationId}
              onValueChange={setRationId}
              options={[
                { value: ANY, label: t('feedRecord.noRation') },
                ...uniqueById(rations.data?.items ?? []).map((ration) => ({
                  value: ration.id,
                  label: ration.name,
                })),
              ]}
            />
          </Field>
        ) : null}
        <Field label={t('feedRecord.from')} hint={t('feedRecord.fromHint')}>
          <Select
            value={fromLocationId}
            onValueChange={setFrom}
            options={[{ value: ANY, label: t('feedRecord.defaultStore') }, ...locations.options]}
          />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit">{t('feedRecord.review')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function Rations({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation(['livestock', 'common']);
  const units = useUnits();
  const species = useSpeciesOptions();
  const pages = useCursorPages();
  const [speciesId, setSpeciesId] = useState(ANY);
  const [editing, setEditing] = useState<Ration | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rations = useApiQuery('listRations', {
    query: {
      ...param('speciesId', speciesId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('rations.loading'),
    emptyTitle: t('rations.empty'),
    emptyDescription: t('rations.emptyBody'),
    errorTitle: t('rations.error'),
    deniedTitle: t('feed.denied'),
  });
  const columns: TableColumn<Ration>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('rations.columns.name'),
      sortValue: (ration) => ration.name,
      cell: (ration) => (
        <span className="grid">
          <span>{ration.name}</span>
          {ration.stage === null ? null : (
            <span className="text-control-sm font-normal text-fg-muted">{ration.stage}</span>
          )}
        </span>
      ),
    },
    {
      id: 'species',
      head: t('rations.columns.species'),
      sortValue: (ration) => ration.species.name,
      cell: (ration) => ration.species.name,
    },
    {
      id: 'feed',
      head: t('rations.columns.feed'),
      sortValue: (ration) => ration.feedProduct.name,
      cell: (ration) => ration.feedProduct.name,
    },
    {
      id: 'qty',
      head: t('rations.columns.qty'),
      numeric: true,
      sortValue: (ration) => ration.qtyPerHeadPerDay.padStart(12, '0'),
      cell: (ration) => (
        <>
          <QuantityDisplay
            quantity={ration.qtyPerHeadPerDay}
            unit={units.name(ration.uom)}
            places={units.places(ration.uom)}
          />
        </>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'edit',
            head: t('rations.columns.edit'),
            cell: (ration: Ration) => (
              <Button variant="secondary" size="sm" onClick={() => setEditing(ration)}>
                <PencilLine aria-hidden="true" />
                {t('rations.edit', { name: ration.name })}
              </Button>
            ),
          },
        ]
      : []),
  ];
  const view = useTableView(columns);
  return (
    <div className="grid gap-4 pt-4">
      {canManage ? (
        <div>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            {t('rations.new')}
          </Button>
        </div>
      ) : null}
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <TableCard
        view={view}
        query={rations}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(ration) => ration.id}
        tableLabel={t('rations.table')}
        exportName={t('feed.rations')}
        pages={{ state: pages, info: (page) => page.page, label: t('rations.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(speciesId)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setSpeciesId(ANY);
                pages.reset();
              },
            }}
          >
            <FilterSelect
              label={t('filters.species')}
              anyLabel={t('filters.anySpecies')}
              value={speciesId}
              onChange={(value) => {
                setSpeciesId(value);
                pages.reset();
              }}
              options={species}
            />
          </FilterMenu>
        }
      />
      {editing === null ? null : (
        <RationDialog
          ration={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

/** Create a ration, or change an existing one's name, stage and daily quantity (`updateRation`, versioned). */
function RationDialog({
  ration,
  onClose,
  onDone,
}: {
  ration: Ration | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const species = useSpeciesOptions();
  const [name, setName] = useState(ration?.name ?? '');
  const [speciesId, setSpeciesId] = useState('');
  const [feed, setFeed] = useState<ProductRef | null>(null);
  const [qty, setQty] = useState(ration === null ? '' : ration.qtyPerHeadPerDay);
  const [stage, setStage] = useState(ration?.stage ?? '');
  const [problems, setProblems] = useState<string[]>([]);
  const create = useApiMutation('createRation');
  const update = useApiMutation('updateRation');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('rations.failed'),
    emptyTitle: t('rations.failed'),
    errorTitle: t('rations.failed'),
    deniedTitle: t('feed.denied'),
  });
  const quantity = toQuantity(qty);
  const pending = create.isPending || update.isPending;
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={
        ration === null ? t('rations.newTitle') : t('rations.editTitle', { name: ration.name })
      }
      closeLabel={t('common:actions.cancel')}
      icon={Wheat}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const found: string[] = [];
          if (name.trim() === '') found.push('name');
          if (quantity === null || /^0+\.0+$/.test(quantity)) found.push('qty');
          if (ration === null && speciesId === '') found.push('species');
          if (ration === null && feed === null) found.push('feed');
          setProblems(found);
          if (found.length > 0 || quantity === null) return;
          if (ration === null) {
            if (feed === null) return;
            const body = {
              name: name.trim(),
              speciesId,
              feedProductId: feed.id,
              qtyPerHeadPerDay: quantity,
              ...(stage.trim() === '' ? {} : { stage: stage.trim() }),
            };
            create
              .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
              .then((saved) => onDone(t('rations.created', { name: saved.name })))
              .catch(() => undefined);
          } else {
            const body = {
              version: ration.version,
              name: name.trim(),
              qtyPerHeadPerDay: quantity,
              ...(stage.trim() === '' ? {} : { stage: stage.trim() }),
            };
            update
              .mutateAsync({ path: { id: ration.id }, body }, { idempotencyKey: keyFor(body) })
              .then((saved) => onDone(t('rations.saved', { name: saved.name })))
              .catch(() => undefined);
          }
        }}
      >
        <MutationFailure error={ration === null ? create.error : update.error} labels={failure} />
        <Field
          label={t('rations.name')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('name') ? t('common:field.required') : undefined}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {ration === null ? (
          <>
            <Field
              label={t('rations.species')}
              required
              requiredLabel={t('common:field.required')}
              requiredMark="asterisk"
              error={problems.includes('species') ? t('common:field.required') : undefined}
            >
              <Select
                value={speciesId}
                onValueChange={setSpeciesId}
                placeholder={t('rations.chooseSpecies')}
                options={species}
              />
            </Field>
            <ProductPicker
              label={t('rations.feed')}
              value={feed}
              onChange={setFeed}
              error={problems.includes('feed') ? t('common:field.required') : undefined}
            />
          </>
        ) : (
          <p className="text-sm text-fg-muted">
            {t('rations.fixed', { species: ration.species.name, feed: ration.feedProduct.name })}
          </p>
        )}
        <Field
          label={t('rations.qty')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('qty') ? t('feedRecord.qtyInvalid') : undefined}
        >
          <NumberInput value={qty} onValueChange={setQty} decimals={3} />
        </Field>
        <Field label={t('rations.stage')} hint={t('rations.stageHint')}>
          <Input value={stage} onChange={(event) => setStage(event.target.value)} />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={pending} loadingLabel={t('rations.saving')}>
            {t('rations.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
