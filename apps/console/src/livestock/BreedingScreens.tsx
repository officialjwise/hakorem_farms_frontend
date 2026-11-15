import { Baby, HeartPulse, Plus, Trash2, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  AnimalTag,
  Button,
  DatePicker,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterMenu,
  formatWeight,
  IconChip,
  Input,
  MutationFailure,
  NOT_APPLICABLE,
  NumberInput,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
  useTableView,
  WeightInput,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { AnimalPicker, type PickedAnimal } from './animals';
import { BreedingStatusBadge } from './presentation';

type BreedingRecord = components['schemas']['BreedingRecord'];
const STATUSES = ['MATED', 'CONFIRMED', 'BORN', 'FAILED'] as const;
const SEXES = ['FEMALE', 'MALE', 'UNKNOWN'] as const;

function Tag({ animal }: { animal: { id: string; tagNo: string } }) {
  const auth = useAuth();
  return auth.can('liv.animal.read') ? (
    <Link to={`/animals/${animal.id}`} className="text-accent-text underline">
      <AnimalTag tagNo={animal.tagNo} />
    </Link>
  ) : (
    <AnimalTag tagNo={animal.tagNo} />
  );
}

/**
 * FR-LIV breeding: each mating, its dam and sire, when the birth is due and how it went, filtered by state,
 * by dam (from an animal's page) and by births due before a date.
 */
export function BreedingScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const pages = useCursorPages();
  const [search, setSearch] = useSearchParams();
  const damId = search.get('damId');
  const [status, setStatus] = useState(ANY);
  const [dueBefore, setDueBefore] = useState('');
  const [creating, setCreating] = useState(false);
  const records = useApiQuery('listBreedingRecords', {
    query: {
      ...param('status', status),
      ...(damId === null ? {} : { damId }),
      ...(dueBefore === '' ? {} : { dueBefore }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('breedingList.loading'),
    emptyTitle: t('breedingList.empty'),
    emptyDescription: t('breedingList.emptyBody'),
    errorTitle: t('breedingList.error'),
    deniedTitle: t('breedingList.denied'),
  });
  const columns: TableColumn<BreedingRecord>[] = [
    {
      id: 'dam',
      rowHeader: true,
      head: t('breedingList.columns.dam'),
      sortValue: (record) => record.dam.tagNo,
      cell: (record) => (
        <span className="flex items-center gap-3">
          <IconChip icon={HeartPulse} tone="info" size="sm" />
          <span className="grid">
            <Link to={`/breeding/${record.id}`} className="text-accent-text underline">
              {t('breedingList.open', { tag: record.dam.tagNo })}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {record.sire === null
                ? t('breedingList.sireUnknown')
                : t('breedingList.sire', { tag: record.sire.tagNo })}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'mated',
      head: t('breedingList.columns.mated'),
      sortValue: (record) => record.matedOn,
      cell: (record) => record.matedOn,
    },
    {
      id: 'due',
      head: t('breedingList.columns.due'),
      sortValue: (record) => record.actualBirthOn ?? record.expectedBirthOn ?? '',
      cell: (record) =>
        record.actualBirthOn !== null
          ? t('breedingList.bornOn', { date: record.actualBirthOn })
          : (record.expectedBirthOn ?? t('breedingList.noDueDate')),
    },
    {
      id: 'status',
      head: t('breedingList.columns.status'),
      sortValue: (record) => record.status,
      cell: (record) => <BreedingStatusBadge status={record.status} />,
    },
    {
      id: 'births',
      head: t('breedingList.columns.births'),
      numeric: true,
      sortValue: (record) => record.liveBirths ?? -1,
      cell: (record) =>
        record.liveBirths === null
          ? NOT_APPLICABLE
          : t('breedingList.births', { live: record.liveBirths, litter: record.litterSize ?? 0 }),
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="breeding-title" className="grid gap-4">
      <PageHeader
        title={t('breedingList.title')}
        titleId="breeding-title"
        description={t('breedingList.description')}
        actions={
          auth.can('liv.breeding.record') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t('breedingList.new')}
            </Button>
          ) : undefined
        }
      />
      {damId === null ? null : (
        <Alert severity="info" title={t('breedingList.oneDam')}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch({});
              pages.reset();
            }}
          >
            {t('breedingList.allDams')}
          </Button>
        </Alert>
      )}
      <TableCard
        view={view}
        query={records}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(record) => record.id}
        tableLabel={t('breedingList.table')}
        exportName={t('breedingList.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('breedingList.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status) + (dueBefore === '' ? 0 : 1)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                setDueBefore('');
                pages.reset();
              },
            }}
          >
            <FilterSelect
              label={t('filters.status')}
              anyLabel={t('filters.anyStatus')}
              value={status}
              onChange={(value) => {
                setStatus(value);
                pages.reset();
              }}
              options={STATUSES.map((value) => ({ value, label: t(`breedingStatus.${value}`) }))}
            />
            <Field label={t('filters.dueBefore')}>
              <DatePicker
                value={dueBefore}
                onChange={(event) => {
                  setDueBefore(event.target.value);
                  pages.reset();
                }}
              />
            </Field>
          </FilterMenu>
        }
      />
      {creating ? (
        <NewMating
          onClose={() => setCreating(false)}
          onDone={(record) => navigate(`/breeding/${record.id}`)}
        />
      ) : null}
    </section>
  );
}

/** Record a mating: the dam (a female), the sire if known, the day, and the birth expected. */
function NewMating({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (record: BreedingRecord) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const [dam, setDam] = useState<PickedAnimal | null>(null);
  const [sire, setSire] = useState<PickedAnimal | null>(null);
  const [matedOn, setMatedOn] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const create = useApiMutation('createBreedingRecord');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('mating.failed'),
    emptyTitle: t('mating.failed'),
    errorTitle: t('mating.failed'),
    deniedTitle: t('mating.denied'),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('mating.title')}
      description={t('mating.body')}
      closeLabel={t('common:actions.cancel')}
      icon={HeartPulse}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const found: string[] = [];
          if (dam === null) found.push('dam');
          if (matedOn === '') found.push('matedOn');
          setProblems(found);
          if (dam === null || matedOn === '') return;
          const body = {
            damId: dam.id,
            matedOn,
            ...(sire === null ? {} : { sireId: sire.id }),
            ...(expected === '' ? {} : { expectedBirthOn: expected }),
            ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
          };
          create
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then(onDone)
            .catch(() => undefined);
        }}
      >
        <MutationFailure error={create.error} labels={failure} />
        <AnimalPicker
          label={t('mating.dam')}
          value={dam}
          onChange={setDam}
          filter={(animal) => animal.sex === 'FEMALE'}
          error={problems.includes('dam') ? t('common:field.required') : undefined}
        />
        <AnimalPicker
          label={t('mating.sire')}
          value={sire}
          onChange={setSire}
          required={false}
          filter={(animal) => animal.sex === 'MALE'}
        />
        <Field
          label={t('mating.matedOn')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('matedOn') ? t('common:field.required') : undefined}
        >
          <DatePicker value={matedOn} onChange={(event) => setMatedOn(event.target.value)} />
        </Field>
        <Field label={t('mating.expected')}>
          <DatePicker value={expected} onChange={(event) => setExpected(event.target.value)} />
        </Field>
        <Field label={t('mating.notes')}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={create.isPending} loadingLabel={t('mating.saving')}>
            {t('mating.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** One breeding record: its facts, its offspring, and recording the birth or that it failed. */
export function BreedingRecordScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const { id = '' } = useParams();
  const record = useApiQuery('getBreedingRecord', { path: { id } });
  const labels = useStateLabels({
    loading: t('breedingRecord.loading'),
    emptyTitle: t('breedingRecord.notFound'),
    errorTitle: t('breedingRecord.error'),
    deniedTitle: t('breedingRecord.denied'),
  });
  const back = (
    <Link to="/breeding" className="w-fit text-accent-text underline">
      {t('breedingRecord.back')}
    </Link>
  );
  if (record.error?.status === 404) {
    return (
      <EmptyState
        title={t('breedingRecord.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={record}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
    >
      {(current) => <RecordDetail record={current} back={back} />}
    </QueryBoundary>
  );
}

function RecordDetail({ record, back }: { record: BreedingRecord; back: ReactNode }) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const [open, setOpen] = useState<'birth' | 'fail' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = useApiMutation('failBreedingRecord');
  const failKey = useIntentKey();
  const failLabels = useStateLabels({
    loading: t('breedingRecord.notFailed'),
    emptyTitle: t('breedingRecord.notFailed'),
    errorTitle: t('breedingRecord.notFailed'),
    deniedTitle: t('breedingRecord.denied'),
  });
  const open_ = record.status === 'MATED' || record.status === 'CONFIRMED';
  const rows: [string, ReactNode][] = [
    [t('breedingRecord.dam'), <Tag key="dam" animal={record.dam} />],
    [
      t('breedingRecord.sire'),
      record.sire === null ? (
        t('breedingList.sireUnknown')
      ) : (
        <Tag key="sire" animal={record.sire} />
      ),
    ],
    [t('breedingRecord.mated'), record.matedOn],
    [t('breedingRecord.expected'), record.expectedBirthOn ?? t('breedingList.noDueDate')],
    [t('breedingRecord.actual'), record.actualBirthOn ?? NOT_APPLICABLE],
    [
      t('breedingRecord.births'),
      record.liveBirths === null
        ? NOT_APPLICABLE
        : t('breedingList.births', { live: record.liveBirths, litter: record.litterSize ?? 0 }),
    ],
    [t('mating.notes'), record.notes ?? NOT_APPLICABLE],
  ];
  return (
    <article aria-labelledby="breeding-record-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <PageHeader
          title={t('breedingRecord.title', { tag: record.dam.tagNo })}
          titleId="breeding-record-title"
          description={<BreedingStatusBadge status={record.status} />}
          actions={
            open_ && auth.can('liv.breeding.record') ? (
              <>
                <Button onClick={() => setOpen('birth')}>
                  <Baby aria-hidden="true" />
                  {t('breedingRecord.recordBirth')}
                </Button>
                <Button variant="secondary" onClick={() => setOpen('fail')}>
                  <XCircle aria-hidden="true" />
                  {t('breedingRecord.fail')}
                </Button>
              </>
            ) : undefined
          }
        />
      </div>
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="offspring-title" className="grid gap-2">
        <h2 id="offspring-title" className="text-lg font-semibold">
          {t('breedingRecord.offspring')}
        </h2>
        {record.offspring.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('breedingRecord.noOffspring')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {record.offspring.map((young) => (
              <li key={young.id} className="flex items-center gap-1">
                <Tag animal={young} />
                <span className="text-control-sm text-fg-muted">{t(`sex.${young.sex}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open === 'birth' ? (
        <RecordBirth
          record={record}
          onClose={() => setOpen(null)}
          onDone={(saved) => {
            setOpen(null);
            setNotice(t('birth.done', { count: saved.liveBirths ?? 0 }));
          }}
        />
      ) : null}
      <ReasonDialog
        open={open === 'fail'}
        onOpenChange={(next) => setOpen(next ? 'fail' : null)}
        title={t('breedingRecord.failTitle', { tag: record.dam.tagNo })}
        body={t('breedingRecord.failBody')}
        submitLabel={t('breedingRecord.fail')}
        destructive
        error={fail.error}
        failureLabels={failLabels}
        onConfirm={async (reason) => {
          const body = { reason };
          await fail.mutateAsync(
            { path: { id: record.id }, body },
            { idempotencyKey: failKey(body) },
          );
          setOpen(null);
          setNotice(t('breedingRecord.failed'));
        }}
      />
    </article>
  );
}

interface YoungDraft {
  key: string;
  tagNo: string;
  sex: (typeof SEXES)[number];
  weightKg: string | null;
}

/**
 * Record the birth: the day, the litter size, and each live young with its tag and sex (a weight if one was
 * taken). Each young becomes an animal in the register, linked to its dam at nil cost, so the young are
 * confirmed before they are sent.
 */
function RecordBirth({
  record,
  onClose,
  onDone,
}: {
  record: BreedingRecord;
  onClose: () => void;
  onDone: (saved: BreedingRecord) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const [bornOn, setBornOn] = useState('');
  const [litter, setLitter] = useState('');
  const [young, setYoung] = useState<YoungDraft[]>([
    { key: 'y1', tagNo: '', sex: 'FEMALE', weightKg: null },
  ]);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const birth = useApiMutation('recordBirth');
  const keyFor = useIntentKey();
  const live = young.filter((row) => row.tagNo.trim() !== '');
  const body = {
    actualBirthOn: bornOn,
    litterSize: litter === '' ? live.length : Number.parseInt(litter, 10),
    offspring: live.map((row) => ({
      tagNo: row.tagNo.trim(),
      sex: row.sex,
      ...(row.weightKg === null ? {} : { weightKg: row.weightKg, weightSource: 'SCALE' as const }),
    })),
  };
  const update = (key: string, change: Partial<YoungDraft>) =>
    setYoung((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  if (confirming) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(next) => (next ? undefined : setConfirming(false))}
        title={t('birth.confirmTitle', { tag: record.dam.tagNo })}
        body={t('birth.confirmBody', { count: body.offspring.length, litter: body.litterSize })}
        changes={body.offspring.map((row) => ({
          label: row.tagNo,
          after:
            'weightKg' in row && row.weightKg !== undefined
              ? t('birth.youngWithWeight', {
                  sex: t(`sex.${row.sex}`),
                  weight: formatWeight(row.weightKg),
                })
              : t(`sex.${row.sex}`),
        }))}
        consequence={t('birth.consequence')}
        confirmLabel={t('birth.save')}
        pendingLabel={t('birth.saving')}
        pending={birth.isPending}
        error={birth.error}
        failedTitle={t('birth.failed')}
        icon={Baby}
        confirmIcon={Baby}
        onConfirm={() =>
          void birth
            .mutateAsync({ path: { id: record.id }, body }, { idempotencyKey: keyFor(body) })
            .then(onDone)
            .catch(() => undefined)
        }
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('birth.title', { tag: record.dam.tagNo })}
      description={t('birth.body')}
      closeLabel={t('common:actions.cancel')}
      icon={Baby}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const found: string[] = [];
          if (bornOn === '') found.push('bornOn');
          const litterSize = litter === '' ? live.length : Number.parseInt(litter, 10);
          if (litterSize < live.length) found.push('litter');
          setProblems(found);
          if (found.length === 0) setConfirming(true);
        }}
      >
        <Field
          label={t('birth.bornOn')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
          error={problems.includes('bornOn') ? t('common:field.required') : undefined}
        >
          <DatePicker value={bornOn} onChange={(event) => setBornOn(event.target.value)} />
        </Field>
        <Field
          label={t('birth.litter')}
          hint={t('birth.litterHint')}
          error={problems.includes('litter') ? t('birth.litterTooSmall') : undefined}
        >
          <NumberInput value={litter} onValueChange={setLitter} />
        </Field>
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-semibold">{t('birth.young')}</legend>
          {young.map((row, index) => (
            <div key={row.key} className="grid gap-2 rounded-md border border-border p-3">
              <Field label={t('birth.tag', { n: index + 1 })}>
                <Input
                  value={row.tagNo}
                  onChange={(event) => update(row.key, { tagNo: event.target.value })}
                />
              </Field>
              <Field label={t('birth.sex', { n: index + 1 })}>
                <Select
                  value={row.sex}
                  onValueChange={(value) =>
                    update(row.key, { sex: SEXES.find((s) => s === value) ?? 'UNKNOWN' })
                  }
                  options={SEXES.map((value) => ({ value, label: t(`sex.${value}`) }))}
                />
              </Field>
              <Field label={t('birth.weight', { n: index + 1 })}>
                <WeightInput
                  value={row.weightKg}
                  onValueChange={(value) => update(row.key, { weightKg: value })}
                />
              </Field>
              {young.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setYoung((rows) => rows.filter((other) => other.key !== row.key))}
                >
                  <Trash2 aria-hidden="true" />
                  {t('birth.remove', { n: index + 1 })}
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setYoung((rows) => [
                ...rows,
                {
                  key: `y${rows.length + 1}-${Date.now()}`,
                  tagNo: '',
                  sex: 'FEMALE',
                  weightKg: null,
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            {t('birth.add')}
          </Button>
        </fieldset>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit">{t('birth.review')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
