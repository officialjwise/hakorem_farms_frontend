import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CirclePlus, CircleMinus, PencilLine, Send, Tags } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
  DialogActions,
  EmptyState,
  ErrorState,
  Form,
  FormField,
  FormSubmitButton,
  Field,
  MoneyInput,
  MutationFailure,
  NumberInput,
  Select,
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
  type QuantityPlaces,
  Alert,
  formatQuantity,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { ProductPicker, type ProductRef } from '../stock/LinesEditor';
import { toQuantity, useLineUnits, useUnits } from '../stock/units';
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
  type PriceListEntryInput,
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

/**
 * What a line prices, in words: the product, its grade and band, the selling unit (a crate or a single
 * egg, 2.1.0), and the quantity break counted in that unit, with the same break in the base unit as the
 * API states it (`minQtyBase`). Nothing is converted here.
 */
export function entryWords(
  entry: PriceListEntry,
  t: (key: string, options?: Record<string, unknown>) => string,
  units: { name: (code: string) => string; places: (code: string) => QuantityPlaces },
): string[] {
  const qty = (value: string, code: string) =>
    `${formatQuantity(value, { places: units.places(code) })} ${units.name(code)}`;
  return [
    entry.grade?.name,
    entry.weightBand === null
      ? undefined
      : t('band.range', {
          code: entry.weightBand.code,
          min: entry.weightBand.minKg,
          max: entry.weightBand.maxKg,
        }),
    entry.basis === 'PER_KG' ? undefined : t('entry.perUnit', { unit: units.name(entry.uom) }),
    entry.minQty === '0.000'
      ? undefined
      : entry.minQtyBase === entry.minQty
        ? t('entry.minQty', { qty: qty(entry.minQty, entry.uom) })
        : // The entry names no base unit (`ProductRef` has none), so the base figure is shown bare.
          t('entry.minQtyBoth', {
            qty: qty(entry.minQty, entry.uom),
            base: formatQuantity(entry.minQtyBase, { places: 0 }),
          }),
  ].filter((part): part is string => part !== undefined);
}

/** A line's own name for its buttons: two lines of one product (a crate, an egg) never share one. */
function entryName(
  entry: PriceListEntry,
  t: (key: string, options?: Record<string, unknown>) => string,
  units: { name: (code: string) => string; places: (code: string) => QuantityPlaces },
): string {
  return [entry.product.name, ...entryWords(entry, t, units)].join(', ');
}

/** Product, then grade and band when the line has them, its unit and its break: what the line prices. */
function LineName({ entry }: { entry: PriceListEntry }) {
  const { t } = useTranslation('catalogue');
  const units = useUnits();
  const parts = entryWords(entry, t as never, units);
  return (
    <span className="grid">
      <span className="font-semibold">{entry.product.name}</span>
      <code className="text-control-sm text-fg-muted">{entry.product.sku}</code>
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
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const units = useUnits();
  const named = (entry: PriceListEntry) => entryName(entry, t as never, units);
  const replace = useApiMutation('replacePriceListEntries');
  const keyFor = useIntentKey();
  const from = <When instant={version.validFrom} />;

  /**
   * Sends the whole draft back with one line changed, dropped or added (the contract replaces every
   * entry).
   */
  const send = async (
    change: { id: string; next: PriceListEntry | null } | { add: PriceListEntryInput },
  ) => {
    const entries =
      'add' in change
        ? [...draftEntries.map(toInput), change.add]
        : draftEntries.flatMap((entry) =>
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
                            aria-label={t('entry.editFor', { name: named(line) })}
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
                            aria-label={t('entry.removeFor', { name: named(line) })}
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
      {editable ? (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              replace.reset();
              setNotice(null);
              setAdding(true);
            }}
          >
            <CirclePlus aria-hidden="true" />
            {t('entry.add')}
          </Button>
        </div>
      ) : null}
      {adding ? (
        <AddEntryDialog
          error={replace.error}
          onClose={() => setAdding(false)}
          onSave={async (add, name) => {
            await send({ add });
            setAdding(false);
            setNotice(t('entry.added', { name }));
          }}
        />
      ) : null}
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
      requiredMark="asterisk"
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
      icon={Tags}
      requiredNote={t('common:field.requiredNote')}
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
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <FormSubmitButton loadingLabel={t('entry.saving')}>
            <CircleCheck aria-hidden="true" />
            {t('entry.save')}
          </FormSubmitButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

/**
 * A new price in the draft: a product, the unit it is sold in (a crate or a single egg, each with its own
 * price, never one worked out from the other: 2.1.0), what the price multiplies, the band, and a quantity
 * break counted in that unit ("from 10 crates"). The server converts the break to the base unit and checks
 * the band; its refusal stays in the dialog.
 */
function AddEntryDialog({
  error,
  onClose,
  onSave,
}: {
  error: Parameters<typeof MutationFailure>[0]['error'];
  onClose: () => void;
  onSave: (entry: PriceListEntryInput, name: string) => Promise<void>;
}) {
  const { t } = useTranslation(['catalogue', 'stock', 'common']);
  const failureLabels = useEntryFailureLabels();
  const names = useUnits();
  const required = t('common:field.required');
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [uom, setUom] = useState<string | null>(null);
  const [basis, setBasis] = useState<'PER_UNIT' | 'PER_HEAD' | 'PER_KG'>('PER_UNIT');
  const [list, setList] = useState<number | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [ceiling, setCeiling] = useState<number | null>(null);
  const [minQty, setMinQty] = useState('');
  const [quoteOnly, setQuoteOnly] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const { units } = useLineUnits(product);
  const unit = uom ?? product?.baseUom ?? '';
  const breakQty = minQty.trim() === '' ? '0.000' : toQuantity(minQty);
  const ready =
    product !== null && list !== null && floor !== null && ceiling !== null && breakQty !== null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (!ready) return;
    const entry: PriceListEntryInput = {
      productId: product.id,
      basis,
      listPricePesewas: list,
      floorPricePesewas: floor,
      ceilingPricePesewas: ceiling,
      quoteOnly,
      minQty: breakQty,
      // A PER_KG price names no unit (NOT_PER_KG); the base unit is sent as nothing.
      ...(basis === 'PER_KG' || uom === null ? {} : { uom }),
    };
    setPending(true);
    onSave(entry, product.name)
      .catch(() => undefined)
      .finally(() => setPending(false));
  };
  const money = (label: string, value: number | null, set: (value: number | null) => void) => (
    <Field
      label={label}
      required
      requiredLabel={required}
      error={checked && value === null ? required : undefined}
    >
      <MoneyInput value={value} onValueChange={set} />
    </Field>
  );
  const per = unit === '' ? '' : names.name(unit);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('entry.addTitle')}
      description={t('entry.addBody')}
      closeLabel={t('common:actions.cancel')}
      icon={Tags}
      requiredNote={t('common:field.requiredNote')}
    >
      <form className="grid gap-3 pb-2" onSubmit={submit} noValidate>
        <MutationFailure error={error} labels={failureLabels} />
        <ProductPicker
          label={t('entry.fields.product')}
          value={product}
          onChange={(next) => {
            setProduct(next);
            setUom(null);
          }}
          {...(checked && product === null ? { error: required } : {})}
        />
        <Field label={t('entry.fields.basis')}>
          <Select
            value={basis}
            onValueChange={(value) =>
              setBasis(
                value === 'PER_KG' ? 'PER_KG' : value === 'PER_HEAD' ? 'PER_HEAD' : 'PER_UNIT',
              )
            }
            options={(['PER_UNIT', 'PER_HEAD', 'PER_KG'] as const).map((value) => ({
              value,
              label: t(`basis.${value}`),
            }))}
          />
        </Field>
        {product !== null && basis !== 'PER_KG' && units.length > 1 ? (
          <Field label={t('entry.fields.unit')} hint={t('entry.unitHint')}>
            <Select
              value={unit}
              onValueChange={(code) => setUom(code === product.baseUom ? null : code)}
              options={units.map((u) => ({ value: u.code, label: names.name(u.code) }))}
            />
          </Field>
        ) : null}
        {money(t('entry.fields.listIn', { unit: per }), list, setList)}
        {money(t('entry.fields.floorIn', { unit: per }), floor, setFloor)}
        {money(t('entry.fields.ceilingIn', { unit: per }), ceiling, setCeiling)}
        <Field
          label={t('entry.fields.minQtyIn', { unit: per })}
          hint={t('entry.minQtyHint', { unit: per })}
          error={
            checked && breakQty === null
              ? t('stock:lines.qtyInvalid', { count: names.places(unit) })
              : undefined
          }
        >
          <NumberInput decimals={names.places(unit)} value={minQty} onValueChange={setMinQty} />
        </Field>
        <Field label={t('entry.fields.quoteOnly')} hint={t('entry.quoteOnlyHint')}>
          <Checkbox checked={quoteOnly} onCheckedChange={(next) => setQuoteOnly(next === true)} />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={pending} loadingLabel={t('entry.saving')}>
            <CircleCheck aria-hidden="true" />
            {t('entry.addSave')}
          </Button>
        </DialogActions>
      </form>
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
      icon={Tags}
      iconTone="critical"
    >
      <div className="grid gap-3 pb-2">
        <MutationFailure error={error} labels={failureLabels} />
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button
            variant="danger"
            loading={pending}
            loadingLabel={t('entry.saving')}
            onClick={() => {
              onConfirm().catch(() => undefined);
            }}
          >
            <CircleMinus aria-hidden="true" />
            {t('entry.removeConfirm')}
          </Button>
        </DialogActions>
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
        icon={Tags}
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
          <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={() => setOpen(false)}>
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
              <Send aria-hidden="true" />
              {t('submit.confirm')}
            </Button>
          </DialogActions>
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
