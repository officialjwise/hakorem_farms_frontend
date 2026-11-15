import { Scale } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  AnimalTag,
  Button,
  DateRangeMenu,
  Dialog,
  DialogActions,
  Field,
  FilterMenu,
  formatWeight,
  MutationFailure,
  Select,
  Skeleton,
  useTableView,
  WeightDisplay,
  WeightInput,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { newRecordId } from '../lib/clientId';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { uniqueById, useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useLocations } from '../stock/locations';
import { HealthEventDialog, MortalityDialog, RecordWeightDialog } from './forms';
import { RecordFeedDialog } from './FeedScreen';
import { AnimalPicker, type PickedAnimal } from './animals';
import { rangeQuery } from './range';

type WeightRecord = components['schemas']['WeightRecord'];
const WEIGHT_SOURCES = ['SCALE', 'MANUAL', 'ESTIMATE'] as const;

/**
 * FR-LIV weights: every weighing, newest first as the API lists it, by pen and date. Weighing is done at the
 * pen on a phone: choose the pen, type each animal's weight down the list, send them together. Each record
 * carries a client id, so sending again after a dropped connection records nothing twice (`duplicates`).
 */
export function WeightsScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const locations = useLocations();
  const rangeWords = useDateRangeWords();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [locationId, setLocationId] = useState(ANY);
  const [weighing, setWeighing] = useState<'pen' | 'one' | null>(null);
  const [penWork, setPenWork] = useState<'health' | 'feed' | 'mortality' | null>(null);
  const [one, setOne] = useState<PickedAnimal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const weights = useApiQuery('listWeightRecords', {
    query: {
      ...rangeQuery(range, 'instant'),
      ...param('locationId', locationId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('weights.loading'),
    emptyTitle: t('weights.empty'),
    emptyDescription: t('weights.emptyBody'),
    errorTitle: t('weights.error'),
    deniedTitle: t('weights.denied'),
  });
  const canRead = auth.can('liv.animal.read');
  // Someone who records at the pen but cannot open those lists (the Farm hand, A-158) records from here.
  const penWorks = (
    [
      ['health', 'liv.health.record', 'liv.health.read'],
      ['feed', 'liv.feed.record', 'liv.feed.read'],
      ['mortality', 'liv.mortality.report', 'liv.mortality.read'],
    ] as const
  ).filter(([, record, read]) => auth.can(record) && !auth.can(read));
  const columns: TableColumn<WeightRecord>[] = [
    {
      id: 'animal',
      rowHeader: true,
      head: t('weights.columns.animal'),
      sortValue: (row) => row.stockUnit.identifier,
      cell: (row) =>
        canRead && row.stockUnit.tracking === 'SERIAL' ? (
          <Link to={`/animals/${row.stockUnit.id}`} className="text-accent-text underline">
            <AnimalTag tagNo={row.stockUnit.identifier} />
          </Link>
        ) : (
          <AnimalTag tagNo={row.stockUnit.identifier} />
        ),
    },
    {
      id: 'weight',
      head: t('weights.columns.weight'),
      numeric: true,
      sortValue: (row) => row.weightKg.padStart(12, '0'),
      cell: (row) => (
        <span className="grid justify-items-end">
          <WeightDisplay kilograms={row.weightKg} />
          {row.headWeighed > 1 ? (
            <span className="text-control-sm text-fg-muted">
              {t('weights.perHead', { count: row.headWeighed })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'source',
      head: t('weights.columns.source'),
      sortValue: (row) => row.weightSource,
      cell: (row) => t(`weightSource.${row.weightSource}`),
    },
    {
      id: 'when',
      head: t('weights.columns.when'),
      sortValue: (row) => row.measuredAt,
      cell: (row) => (
        <>
          <When instant={row.measuredAt} /> · {row.actor.displayName}
        </>
      ),
    },
  ];
  const view = useTableView(columns);
  const done = (message: string) => {
    setWeighing(null);
    setOne(null);
    setNotice(message);
  };
  return (
    <section aria-labelledby="weights-title" className="grid gap-4">
      <PageHeader
        title={t('weights.title')}
        titleId="weights-title"
        description={t('weights.description')}
        actions={
          auth.can('liv.weight.record') ? (
            <>
              {canRead ? (
                <Button onClick={() => setWeighing('pen')}>
                  <Scale aria-hidden="true" />
                  {t('weights.weighPen')}
                </Button>
              ) : null}
              <Button
                variant={canRead ? 'secondary' : 'primary'}
                onClick={() => setWeighing('one')}
              >
                {t('weights.weighOne')}
              </Button>
            </>
          ) : undefined
        }
      />
      {penWorks.length === 0 ? null : (
        <section aria-labelledby="pen-work-title" className="grid gap-2">
          <h2 id="pen-work-title" className="text-sm font-semibold">
            {t('weights.penWork')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {penWorks.map(([key]) => (
              <Button key={key} variant="secondary" onClick={() => setPenWork(key)}>
                {t(`weights.penWorkAction.${key}`)}
              </Button>
            ))}
          </div>
        </section>
      )}
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <TableCard
        view={view}
        query={weights}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('weights.table')}
        exportName={t('weights.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('weights.pages') }}
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
      {penWork === 'health' ? (
        <HealthEventDialog
          animal={null}
          onClose={() => setPenWork(null)}
          onDone={(message) => {
            setPenWork(null);
            setNotice(message);
          }}
        />
      ) : null}
      {penWork === 'feed' ? (
        <RecordFeedDialog
          onClose={() => setPenWork(null)}
          onDone={(message) => {
            setPenWork(null);
            setNotice(message);
          }}
        />
      ) : null}
      {penWork === 'mortality' ? (
        <MortalityDialog
          animal={null}
          onClose={() => setPenWork(null)}
          onDone={(record) => {
            setPenWork(null);
            setNotice(t('mortality.reportedOnly', { kind: t(`mortalityKind.${record.kind}`) }));
          }}
        />
      ) : null}
      {weighing === 'pen' ? <WeighPen onClose={() => setWeighing(null)} onDone={done} /> : null}
      {weighing === 'one' && one === null ? (
        <ChooseAnimal onClose={() => setWeighing(null)} onChosen={setOne} />
      ) : null}
      {weighing === 'one' && one !== null ? (
        <RecordWeightDialog
          animal={one}
          onClose={() => {
            setWeighing(null);
            setOne(null);
          }}
          onDone={done}
        />
      ) : null}
    </section>
  );
}

/** The first step of weighing one animal from this screen: which one. */
function ChooseAnimal({
  onClose,
  onChosen,
}: {
  onClose: () => void;
  onChosen: (animal: PickedAnimal) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const [picked, setPicked] = useState<PickedAnimal | null>(null);
  const [missing, setMissing] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('weights.chooseTitle')}
      closeLabel={t('common:actions.cancel')}
      icon={Scale}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (picked === null) {
            setMissing(true);
            return;
          }
          onChosen(picked);
        }}
      >
        <AnimalPicker
          label={t('weights.animal')}
          value={picked}
          onChange={(animal) => {
            setPicked(animal);
            setMissing(false);
          }}
          error={missing ? t('common:field.required') : undefined}
        />
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit">{t('weights.next')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * Weigh a pen: the live animals in it (`listAnimals` by location, every page: a pen is a short list), one
 * weight field each, typed and tabbed down the list. Only the animals given a weight are sent. Each keeps
 * the client id it was given when the form opened, so a resend is answered as duplicates, not new records.
 */
function WeighPen({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useTranslation(['livestock', 'common']);
  const locations = useLocations();
  const [locationId, setLocationId] = useState('');
  const [source, setSource] = useState<(typeof WEIGHT_SOURCES)[number]>('SCALE');
  const [weights, setWeights] = useState<Record<string, string | null>>({});
  const ids = useRef<Record<string, string>>({});
  const [at] = useState(() => new Date().toISOString());
  const [problem, setProblem] = useState<string | null>(null);
  const record = useApiMutation('recordWeights');
  const keyFor = useIntentKey();
  const animals = useApiAllPages(
    'listAnimals',
    { query: { locationId, status: 'ALIVE', limit: 100 } },
    { staleClass: 'working', enabled: locationId !== '' },
  );
  const failure = useStateLabels({
    loading: t('weigh.failed'),
    emptyTitle: t('weigh.failed'),
    errorTitle: t('weigh.failed'),
    deniedTitle: t('weigh.denied'),
  });
  const pen = uniqueById(animals.data?.items ?? []);
  const idFor = (animalId: string) => {
    ids.current[animalId] ??= newRecordId();
    return ids.current[animalId];
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('weights.penTitle')}
      description={t('weights.penBody')}
      closeLabel={t('common:actions.cancel')}
      icon={Scale}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const records = pen
            .filter((animal) => {
              const value = weights[animal.id];
              return value !== null && value !== undefined && !/^0+\.0+$/.test(value);
            })
            .map((animal) => ({
              id: idFor(animal.id),
              stockUnitId: animal.id,
              weightKg: weights[animal.id] ?? '',
              weightSource: source,
              measuredAt: at,
            }));
          if (records.length === 0) {
            setProblem(t('weights.noneTyped'));
            return;
          }
          setProblem(null);
          const body = { records };
          record
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then((result) =>
              onDone(
                result.duplicates > 0
                  ? t('weights.doneWithDuplicates', {
                      count: result.accepted,
                      duplicates: result.duplicates,
                    })
                  : t('weights.done', { count: result.accepted }),
              ),
            )
            .catch(() => undefined);
        }}
      >
        <MutationFailure error={record.error} labels={failure} />
        {problem === null ? null : <p role="alert">{problem}</p>}
        <Field
          label={t('weights.pen')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
        >
          <Select
            value={locationId}
            onValueChange={setLocationId}
            placeholder={t('weights.choosePen')}
            options={locations.options}
          />
        </Field>
        <Field label={t('weigh.source')}>
          <Select
            value={source}
            onValueChange={(value) => setSource(WEIGHT_SOURCES.find((s) => s === value) ?? 'SCALE')}
            options={WEIGHT_SOURCES.map((value) => ({ value, label: t(`weightSource.${value}`) }))}
          />
        </Field>
        {locationId === '' ? null : animals.isPending ? (
          <Skeleton label={t('weights.penLoading')} shape="block" className="h-24" />
        ) : animals.isError ? (
          <p role="alert">{t('weights.penError')}</p>
        ) : pen.length === 0 ? (
          <p>{t('weights.penEmpty')}</p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">
              {t('weights.penAnimals', { count: pen.length })}
            </legend>
            {pen.map((animal) => (
              <Field
                key={animal.id}
                label={t('weights.weightOf', { tag: animal.tagNo, species: animal.species.name })}
                hint={
                  animal.lastWeightKg === null
                    ? t('weights.neverWeighed')
                    : t('weights.lastWeight', { weight: formatWeight(animal.lastWeightKg) })
                }
              >
                <WeightInput
                  value={weights[animal.id] ?? null}
                  onValueChange={(value) => setWeights((all) => ({ ...all, [animal.id]: value }))}
                />
              </Field>
            ))}
          </fieldset>
        )}
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={record.isPending} loadingLabel={t('weigh.saving')}>
            <Scale aria-hidden="true" />
            {t('weights.send')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
