import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CirclePlus, CircleMinus, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Form,
  FormField,
  FormSubmitButton,
  MoneyInput,
  MutationFailure,
  NOT_APPLICABLE,
  PriceBandDisplay,
  QueryBoundary,
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
  type QueryLike,
  PageHeader,
  Alert,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { When } from '../iam/presentation';
import { PAGE_CAP_EXCEEDED, useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { bothQueries, uniqueById, useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import {
  countChanges,
  previewChanges,
  toInput,
  type ChangeKind,
  type PreviewRow,
  type PriceListEntry,
} from './preview';
import { VersionStatusBadge } from './presentation';

type PriceList = components['schemas']['PriceList'];
type PriceListVersion = components['schemas']['PriceListVersion'];

/** The most entries one read asks for (`PageLimit` maximum). */
const ENTRY_PAGE = 100;

/**
 * FR-MDM price lists with effective dates, and the F4 gate: a draft is previewed, line by line against the
 * version in force, before anyone submits it for activation. Submitting always needs a second person
 * (`submitPriceListVersion`), and nothing changes until they approve.
 */
export function PriceListVersionScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const { id = '' } = useParams();
  const version = useApiQuery('getPriceListVersion', { path: { id } });
  const priceListId = version.data?.priceListId ?? '';
  const list = useApiQuery(
    'getPriceList',
    { path: { id: priceListId } },
    { enabled: priceListId !== '' },
  );
  const labels = useStateLabels({
    loading: t('version.loading'),
    emptyTitle: t('version.notFound'),
    errorTitle: t('version.error'),
    deniedTitle: t('version.denied'),
  });

  if (version.error?.status === 404) {
    return (
      <EmptyState
        title={t('version.notFound')}
        description={t('common:states.notFoundBody')}
        action={
          <Link to="/price-lists" className="text-accent-text underline">
            {t('priceLists.back')}
          </Link>
        }
      />
    );
  }

  return (
    <QueryBoundary
      query={bothQueries(version, list)}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {([current, priceList]) => <VersionDetail version={current} priceList={priceList} />}
    </QueryBoundary>
  );
}

function VersionDetail({
  version,
  priceList,
}: {
  version: PriceListVersion;
  priceList: PriceList;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const previewing = version.status === 'DRAFT' || version.status === 'PENDING_APPROVAL';
  const activeId = priceList.activeVersion?.id ?? null;
  const compareWith = previewing && activeId !== null && activeId !== version.id ? activeId : null;
  const entries = useApiAllPages('listPriceListEntries', {
    path: { id: version.id },
    query: { limit: ENTRY_PAGE },
  });
  const activeEntries = useApiAllPages(
    'listPriceListEntries',
    { path: { id: compareWith ?? version.id }, query: { limit: ENTRY_PAGE } },
    { enabled: compareWith !== null },
  );
  const none: QueryLike<{ items: PriceListEntry[] }, NonNullable<typeof entries.error>> = {
    status: 'success',
    data: { items: [] },
    error: null,
    refetch: () => undefined,
  };
  const both = bothQueries(entries, compareWith === null ? none : activeEntries);
  const labels = useStateLabels({
    loading: t('version.loadingEntries'),
    emptyTitle: t('version.noEntries'),
    emptyDescription: t('version.noEntriesBody'),
    errorTitle: t('version.entriesError'),
    deniedTitle: t('version.denied'),
  });
  const capped =
    entries.error?.code === PAGE_CAP_EXCEEDED || activeEntries.error?.code === PAGE_CAP_EXCEEDED;
  const editable = version.status === 'DRAFT' && auth.can('mdm.price_list.update');

  return (
    <article aria-labelledby="version-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to={`/price-lists/${priceList.id}`} className="text-accent-text underline">
          {t('version.back', { name: priceList.name })}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader
            title={t('version.title', { name: priceList.name, number: version.versionNo })}
            titleId="version-title"
          />
          <VersionStatusBadge status={version.status} />
        </div>
      </div>
      <Card>
        <CardBody>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt className="text-fg-muted">{t('version.validFrom')}</dt>
            <dd>
              <When instant={version.validFrom} />
            </dd>
            <dt className="text-fg-muted">{t('version.validTo')}</dt>
            <dd>
              <When instant={version.validTo} empty={t('version.openEnded')} />
            </dd>
            <dt className="text-fg-muted">{t('version.notes')}</dt>
            <dd>{version.notes ?? NOT_APPLICABLE}</dd>
            <dt className="text-fg-muted">{t('version.createdBy')}</dt>
            <dd>
              {version.createdBy.displayName} · <When instant={version.createdAt} />
            </dd>
            {version.activatedAt !== null ? (
              <>
                <dt className="text-fg-muted">{t('version.activated')}</dt>
                <dd>
                  <When instant={version.activatedAt} />
                  {version.activatedBy === null ? '' : ` · ${version.activatedBy.displayName}`}
                </dd>
              </>
            ) : null}
          </dl>
          <p className="mt-2 text-control-sm text-fg-muted">{t('common:time.zone')}</p>
        </CardBody>
      </Card>
      {version.status === 'PENDING_APPROVAL' ? (
        <Alert severity={'info'} title={t('version.awaiting')} />
      ) : null}
      {capped ? (
        <ErrorState title={t('version.tooMany')} description={t('version.tooManyBody')} />
      ) : (
        <QueryBoundary
          query={both}
          labels={labels}
          isEmpty={([draft, active]) => draft.items.length === 0 && active.items.length === 0}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
        >
          {([draft, active]) =>
            previewing ? (
              <Preview
                version={version}
                priceList={priceList}
                rows={previewChanges(uniqueById(active.items), uniqueById(draft.items))}
                draftEntries={uniqueById(draft.items)}
                hasActive={compareWith !== null}
                editable={editable}
              />
            ) : (
              <EntriesTable entries={uniqueById(draft.items)} />
            )
          }
        </QueryBoundary>
      )}
    </article>
  );
}

const CHANGE_ICON = {
  added: CirclePlus,
  changed: PencilLine,
  removed: CircleMinus,
  unchanged: CircleCheck,
} as const;
const CHANGE_TONE = {
  added: 'good',
  changed: 'warning',
  removed: 'critical',
  unchanged: 'slate',
} as const;

function ChangeBadge({ kind }: { kind: ChangeKind }) {
  const { t } = useTranslation('catalogue');
  return (
    <StatusBadge tone={CHANGE_TONE[kind]} icon={CHANGE_ICON[kind]} label={t(`change.${kind}`)} />
  );
}

/** Product, then grade and band when the line has them: what the line prices. */
function LineName({ entry }: { entry: PriceListEntry }) {
  const { t } = useTranslation('catalogue');
  const parts = [
    entry.grade?.name,
    entry.weightBand === null
      ? undefined
      : t('band.range', {
          code: entry.weightBand.code,
          min: entry.weightBand.minKg,
          max: entry.weightBand.maxKg,
        }),
    entry.minQty === '0.000' ? undefined : t('entry.minQty', { qty: entry.minQty }),
  ].filter((part): part is string => part !== undefined);
  return (
    <span className="grid">
      <span className="font-semibold">{entry.product.name}</span>
      {parts.length === 0 ? null : (
        <span className="text-control-sm text-fg-muted">{parts.join(' · ')}</span>
      )}
    </span>
  );
}

/** A line's price: the band with its list price, or "quote only". Every figure is the API's. */
function Price({ entry, empty }: { entry: PriceListEntry | null; empty: string }) {
  const { t } = useTranslation('catalogue');
  if (entry === null) return <span>{empty}</span>;
  if (entry.quoteOnly) return <span>{t('entry.quoteOnly')}</span>;
  return (
    <PriceBandDisplay
      band={{
        floorPricePesewas: entry.floorPricePesewas,
        ceilingPricePesewas: entry.ceilingPricePesewas,
        listPricePesewas: entry.listPricePesewas,
      }}
      basisLabel={t(`basis.${entry.basis}`)}
      toLabel={t('entry.to')}
      listPriceLabel={t('entry.listPrice')}
    />
  );
}

function Preview({
  version,
  priceList,
  rows,
  draftEntries,
  hasActive,
  editable,
}: {
  version: PriceListVersion;
  priceList: PriceList;
  rows: PreviewRow[];
  draftEntries: PriceListEntry[];
  hasActive: boolean;
  editable: boolean;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const counts = countChanges(rows);
  const [editing, setEditing] = useState<PriceListEntry | null>(null);
  const [removing, setRemoving] = useState<PriceListEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const replace = useApiMutation('replacePriceListEntries');
  const keyFor = useIntentKey();
  const from = <When instant={version.validFrom} />;

  /** Sends the whole draft back with one line changed or dropped (the contract replaces every entry). */
  const send = async (change: { id: string; next: PriceListEntry | null }) => {
    const entries = draftEntries.flatMap((entry) =>
      entry.id !== change.id
        ? [toInput(entry)]
        : change.next === null
          ? []
          : [toInput(change.next)],
    );
    const body = { version: version.version, entries };
    await replace.mutateAsync({ path: { id: version.id }, body }, { idempotencyKey: keyFor(body) });
  };

  return (
    <section aria-labelledby="preview-title" className="grid gap-3">
      <h2 id="preview-title" className="text-xl font-semibold">
        {t('preview.title')}
      </h2>
      <p>
        {hasActive
          ? t('preview.against', {
              number: priceList.activeVersion?.versionNo ?? '',
            })
          : t('preview.noActive')}{' '}
        {t('preview.from')} {from}.
      </p>
      <ul aria-label={t('preview.summary')} className="flex flex-wrap gap-2">
        {(['changed', 'added', 'removed', 'unchanged'] as const).map((kind) => (
          <li key={kind}>
            <StatusBadge
              tone={CHANGE_TONE[kind]}
              icon={CHANGE_ICON[kind]}
              label={t(`preview.count.${kind}`, { count: counts[kind] })}
            />
          </li>
        ))}
      </ul>
      {notice !== null ? <Alert severity={'good'} title={notice} /> : null}
      <TableContainer aria-label={t('preview.table')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('preview.columns.line')}</TableHead>
              <TableHead>{t('preview.columns.change')}</TableHead>
              <TableHead>{t('preview.columns.now')}</TableHead>
              <TableHead>{t('preview.columns.next')}</TableHead>
              {editable ? (
                <TableHead>
                  <span className="sr-only">{t('preview.columns.actions')}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const line = row.next ?? row.now;
              if (line === null) return null;
              return (
                <TableRow key={row.key}>
                  <TableRowHeader>
                    <LineName entry={line} />
                  </TableRowHeader>
                  <TableCell label={t('preview.columns.change')}>
                    <ChangeBadge kind={row.kind} />
                  </TableCell>
                  <TableCell label={t('preview.columns.now')}>
                    <Price entry={row.now} empty={t('preview.notPriced')} />
                  </TableCell>
                  <TableCell label={t('preview.columns.next')}>
                    <Price entry={row.next} empty={t('preview.dropped')} />
                  </TableCell>
                  {editable ? (
                    <TableCell label={t('preview.columns.actions')}>
                      {row.next === null ? null : (
                        <span className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={t('entry.editFor', { name: line.product.name })}
                            onClick={() => {
                              replace.reset();
                              setNotice(null);
                              setEditing(row.next);
                            }}
                          >
                            {t('entry.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={t('entry.removeFor', { name: line.product.name })}
                            onClick={() => {
                              replace.reset();
                              setNotice(null);
                              setRemoving(row.next);
                            }}
                          >
                            {t('entry.remove')}
                          </Button>
                        </span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {editing !== null ? (
        <EditEntryDialog
          entry={editing}
          error={replace.error}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await send({ id: editing.id, next });
            setEditing(null);
            setNotice(t('entry.saved', { name: editing.product.name }));
          }}
        />
      ) : null}
      {removing !== null ? (
        <RemoveEntryDialog
          entry={removing}
          error={replace.error}
          pending={replace.isPending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await send({ id: removing.id, next: null });
            setRemoving(null);
            setNotice(t('entry.removed', { name: removing.product.name }));
          }}
        />
      ) : null}
      {version.status === 'DRAFT' && editable ? (
        <SubmitDraft version={version} counts={counts} />
      ) : null}
    </section>
  );
}

function useEntryFailureLabels() {
  const { t } = useTranslation('catalogue');
  return useStateLabels({
    loading: t('entry.saving'),
    emptyTitle: t('entry.notSaved'),
    errorTitle: t('entry.notSaved'),
    deniedTitle: t('entry.denied'),
  });
}

function EditEntryDialog({
  entry,
  error,
  onClose,
  onSave,
}: {
  entry: PriceListEntry;
  error: Parameters<typeof MutationFailure>[0]['error'];
  onClose: () => void;
  onSave: (next: PriceListEntry) => Promise<void>;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const failureLabels = useEntryFailureLabels();
  const required = t('common:field.required');
  const amount = z.number({ error: required }).int().nonnegative();
  const schema = z.object({
    listPricePesewas: amount,
    floorPricePesewas: amount,
    ceilingPricePesewas: amount,
    quoteOnly: z.boolean(),
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      listPricePesewas: entry.listPricePesewas,
      floorPricePesewas: entry.floorPricePesewas,
      ceilingPricePesewas: entry.ceilingPricePesewas,
      quoteOnly: entry.quoteOnly,
    },
  });
  const basis = t(`basis.${entry.basis}`);
  const money = (name: 'listPricePesewas' | 'floorPricePesewas' | 'ceilingPricePesewas') => (
    <FormField
      name={name}
      label={t(`entry.fields.${name}`, { basis })}
      required
      requiredLabel={required}
    >
      {(field) => (
        <MoneyInput
          ref={field.ref}
          name={field.name}
          onBlur={field.onBlur}
          value={typeof field.value === 'number' ? field.value : null}
          onValueChange={field.onChange}
        />
      )}
    </FormField>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('entry.editTitle', { name: entry.product.name })}
      description={t('entry.editBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={(values) => onSave({ ...entry, ...values })}
        onSubmitError={() => undefined}
      >
        <MutationFailure error={error} labels={failureLabels} />
        {money('listPricePesewas')}
        {money('floorPricePesewas')}
        {money('ceilingPricePesewas')}
        <FormField
          name="quoteOnly"
          label={t('entry.fields.quoteOnly')}
          hint={t('entry.quoteOnlyHint')}
        >
          {(field) => (
            <Checkbox
              ref={field.ref}
              name={field.name}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <FormSubmitButton loadingLabel={t('entry.saving')}>{t('entry.save')}</FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}

function RemoveEntryDialog({
  entry,
  error,
  pending,
  onClose,
  onConfirm,
}: {
  entry: PriceListEntry;
  error: Parameters<typeof MutationFailure>[0]['error'];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const failureLabels = useEntryFailureLabels();
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('entry.removeTitle', { name: entry.product.name })}
      description={t('entry.removeBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <div className="grid gap-3 pb-2">
        <MutationFailure error={error} labels={failureLabels} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            loadingLabel={t('entry.saving')}
            onClick={() => {
              onConfirm().catch(() => undefined);
            }}
          >
            {t('entry.removeConfirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Submitting asks for confirmation with the preview's counts and the valid-from time, because a price list
 * is money. The contract answers 202 when a second person must approve (always, per its description): the
 * words then say nothing has changed yet, and they stay.
 */
function SubmitDraft({
  version,
  counts,
}: {
  version: PriceListVersion;
  counts: Record<ChangeKind, number>;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<'pending' | 'activated' | null>(null);
  const submit = useApiMutation('submitPriceListVersion', {
    invalidates: ['getPriceList', 'listPriceListVersions', 'listPriceLists'],
  });
  const keyFor = useIntentKey();
  const failureLabels = useStateLabels({
    loading: t('submit.sending'),
    emptyTitle: t('submit.failed'),
    errorTitle: t('submit.failed'),
    deniedTitle: t('submit.denied'),
  });

  if (outcome !== null) {
    return (
      <Alert
        severity={'good'}
        title={outcome === 'pending' ? t('submit.pending') : t('submit.activated')}
      />
    );
  }

  const input = { path: { id: version.id } };
  return (
    <div className="grid gap-2">
      <div>
        <Button
          onClick={() => {
            submit.reset();
            setOpen(true);
          }}
        >
          {t('submit.open')}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('submit.title')}
        description={t('submit.body')}
        closeLabel={t('common:actions.cancel')}
      >
        <div className="grid gap-3 pb-2">
          <ul className="grid list-disc gap-1 ps-5">
            <li>{t('preview.count.changed', { count: counts.changed })}</li>
            <li>{t('preview.count.added', { count: counts.added })}</li>
            <li>{t('preview.count.removed', { count: counts.removed })}</li>
            <li>
              {t('submit.from')} <When instant={version.validFrom} />
            </li>
          </ul>
          <MutationFailure error={submit.error} labels={failureLabels} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              loading={submit.isPending}
              loadingLabel={t('submit.sending')}
              onClick={() => {
                submit
                  .mutateAsync(input, { idempotencyKey: keyFor(input) })
                  .then((answer) => {
                    setOpen(false);
                    setOutcome(isApprovalPending(answer) ? 'pending' : 'activated');
                  })
                  // The refusal stays in the dialog as words (MutationFailure), with its reference.
                  .catch(() => undefined);
              }}
            >
              {t('submit.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** A version that is in force or past: its lines, read only. */
function EntriesTable({ entries }: { entries: PriceListEntry[] }) {
  const { t } = useTranslation('catalogue');
  return (
    <TableContainer aria-label={t('version.entries')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('preview.columns.line')}</TableHead>
            <TableHead>{t('entry.price')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableRowHeader>
                <LineName entry={entry} />
              </TableRowHeader>
              <TableCell label={t('entry.price')}>
                <Price entry={entry} empty={NOT_APPLICABLE} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
