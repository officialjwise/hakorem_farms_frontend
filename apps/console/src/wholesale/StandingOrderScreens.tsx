import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  DatePicker,
  EmptyState,
  Field,
  FieldGroup,
  Input,
  MutationFailure,
  QuantityDisplay,
  QueryBoundary,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  formatDateTime,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { documentHref } from '../lib/documents';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ProductPicker } from '../stock/LinesEditor';
import { useLineUnits, useUnits } from '../stock/units';
import { RunOutcomeBadge, StandingOrderStatusBadge } from './presentation';
import {
  FREQUENCIES,
  LINES_MAX,
  WEEKDAYS,
  allowedActions,
  blankDraft,
  blankStandingLine,
  draftFromOrder,
  draftProblems,
  refusedFields,
  scheduleWords,
  standingLineProblems,
  toCreateBody,
  toUpdateBody,
  type DraftProblem,
  type DraftStandingLine,
  type Frequency,
  type RefusedField,
  type ScheduleWords,
  type StandingOrder,
  type StandingOrderDraft,
} from './standingOrders';
import type { components } from '@hakorem/api-client';

type Run = components['schemas']['StandingOrderRun'];
type Weekday = (typeof WEEKDAYS)[number];

/** The words `scheduleWords` says a schedule in, from the wholesale catalogue. */
function useScheduleWords(): ScheduleWords {
  const { t } = useTranslation('wholesale');
  return {
    weekday: (day) => t(`standing.weekday.${day as Weekday}`),
    and: t('standing.and'),
    weekly: (days) => t('standing.every.WEEKLY', { days }),
    fortnightly: (days) => t('standing.every.FORTNIGHTLY', { days }),
    monthly: (day) => t('standing.every.MONTHLY', { day }),
    everyNDays: (count) => t('standing.every.EVERY_N_DAYS', { count }),
    unknown: (frequency) => t('standing.every.unknown', { frequency }),
  };
}

/** The next run day, or why there is none: paused, ended, or nothing left before its last day. */
function useNextRun(): (order: Pick<StandingOrder, 'nextRunOn' | 'status'>) => string {
  const { t } = useTranslation('wholesale');
  return (order) =>
    order.nextRunOn ?? t(`standing.nextRun.${order.status}`, { defaultValue: order.status });
}

/** One line as a sentence: "2 packs Full chicken, 15 kg pack", in the unit it is ordered in. */
function LineWords({ line }: { line: StandingOrder['lines'][number] }) {
  const units = useUnits();
  return (
    <span>
      <QuantityDisplay
        quantity={line.quantity}
        unit={units.after(line.uom, line.quantity)}
        places={units.places(line.uom)}
      />{' '}
      {line.product.name}
    </span>
  );
}

const accountHref = (customerId: string) => `/business-accounts/${customerId}`;
const orderHref = (customerId: string, id: string) =>
  `/business-accounts/${customerId}/standing-orders/${id}`;

/**
 * A buyer's standing orders, on their wholesale account (2.18.0): each schedule in words, what it orders,
 * the next run day the server worked out, and its state. Holders of `whl.standing_order.manage` set one up
 * here; a closed account takes none.
 */
export function CustomerStandingOrders({
  customerId,
  accountClosed,
}: {
  customerId: string;
  accountClosed: boolean;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const canRead = auth.can('whl.standing_order.read');
  const pages = useCursorPages();
  const orders = useApiQuery(
    'listStandingOrders',
    { query: { customerId, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) } },
    { enabled: canRead },
  );
  const labels = useStateLabels({
    loading: t('standing.loading'),
    emptyTitle: t('standing.empty'),
    emptyDescription: t('standing.emptyBody'),
    errorTitle: t('standing.error'),
    deniedTitle: t('standing.denied'),
  });
  const words = useScheduleWords();
  const nextRun = useNextRun();
  const view = useTableView<StandingOrder>([
    {
      id: 'schedule',
      rowHeader: true,
      head: t('standing.columns.schedule'),
      cell: (o) => (
        <Link to={orderHref(customerId, o.id)} className="text-accent-text underline">
          {scheduleWords(o, words)}
        </Link>
      ),
    },
    {
      id: 'lines',
      head: t('standing.columns.lines'),
      cell: (o) => {
        const [first] = o.lines;
        if (first === undefined) return null;
        return (
          <span className="grid">
            <LineWords line={first} />
            {o.lines.length > 1 ? (
              <span className="text-control-sm text-fg-muted">
                {t('standing.moreLines', { count: o.lines.length - 1 })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'nextRun',
      head: t('standing.columns.nextRun'),
      sortValue: (o) => o.nextRunOn ?? '',
      cell: (o) => nextRun(o),
    },
    {
      id: 'status',
      head: t('standing.columns.status'),
      sortValue: (o) => o.status,
      cell: (o) => <StandingOrderStatusBadge status={o.status} />,
    },
  ]);
  const canManage = auth.can('whl.standing_order.manage') && !accountClosed;
  return (
    <section aria-labelledby="standing-orders-title" className="grid gap-2">
      <h2 id="standing-orders-title" className="text-heading-sm font-semibold">
        {t('standing.title')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('standing.intro')}</p>
      {canRead ? (
        <TableCard
          view={view}
          query={orders}
          labels={labels}
          rows={(page) => page.data}
          rowKey={(row) => row.id}
          tableLabel={t('standing.table')}
          exportName={t('standing.title')}
          pages={{ state: pages, info: (page) => page.page, label: t('standing.pages') }}
        />
      ) : (
        <QueryBoundary query={orders} labels={labels} denied isEmpty={() => true}>
          {() => null}
        </QueryBoundary>
      )}
      {canManage ? (
        <div>
          <Button asChild variant="secondary">
            <Link to={`${accountHref(customerId)}/standing-orders/new`}>
              <Plus aria-hidden="true" />
              {t('standing.new')}
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** The lines of a standing order: a product, the unit it is counted in, and how many. */
function StandingLinesEditor({
  lines,
  onChange,
  checked,
}: {
  lines: DraftStandingLine[];
  onChange: (lines: DraftStandingLine[]) => void;
  checked: boolean;
}) {
  const { t } = useTranslation('wholesale');
  const set = (key: string, next: Partial<DraftStandingLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...next } : line)));
  return (
    <section aria-labelledby="standing-lines-title" className="grid gap-3">
      <h2 id="standing-lines-title" className="text-heading-sm font-semibold">
        {t('standingForm.lines')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('standingForm.linesHint')}</p>
      {lines.map((line, index) => (
        <StandingLineCard
          key={line.key}
          line={line}
          index={index}
          checked={checked}
          onChange={(next) => set(line.key, next)}
          onRemove={
            lines.length > 1
              ? () => onChange(lines.filter((other) => other.key !== line.key))
              : undefined
          }
        />
      ))}
      {lines.length > LINES_MAX ? (
        <p role="alert" className="text-critical-fg">
          {t('standingForm.tooManyLines')}
        </p>
      ) : null}
      <div>
        <Button
          variant="secondary"
          onClick={() => onChange([...lines, blankStandingLine()])}
          disabled={lines.length >= LINES_MAX}
        >
          <Plus aria-hidden="true" />
          {t('standingForm.add')}
        </Button>
      </div>
    </section>
  );
}

function StandingLineCard({
  line,
  index,
  checked,
  onChange,
  onRemove,
}: {
  line: DraftStandingLine;
  index: number;
  checked: boolean;
  onChange: (next: Partial<DraftStandingLine>) => void;
  onRemove: (() => void) | undefined;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const units = useUnits();
  const choices = useLineUnits(line.product);
  const problems = checked ? standingLineProblems(line) : [];
  const required = t('common:field.required');
  const unitOptions = choices.units.map((unit) => ({
    value: unit.code,
    label:
      unit.factor === null
        ? units.name(unit.code)
        : t('lines.unitWithFactor', {
            unit: units.name(unit.code),
            factor: unit.factor,
            base: units.after(line.product?.baseUom ?? '', unit.factor),
          }),
  }));
  return (
    <Card>
      <CardBody className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('standingForm.line', { number: index + 1 })}</h3>
          {onRemove === undefined ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={t('standingForm.remove', { number: index + 1 })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
        <ProductPicker
          label={t('standingForm.product')}
          value={line.product}
          error={problems.includes('product') ? required : undefined}
          onChange={(product) => onChange({ product, uom: product?.baseUom ?? '' })}
        />
        {line.product !== null ? (
          <Field label={t('standingForm.unit')} hint={t('standingForm.unitHint')}>
            <Select
              value={line.uom === '' ? line.product.baseUom : line.uom}
              onValueChange={(uom) => onChange({ uom })}
              options={
                unitOptions.length > 0
                  ? unitOptions
                  : [{ value: line.product.baseUom, label: units.name(line.product.baseUom) }]
              }
            />
          </Field>
        ) : null}
        <Field
          label={
            line.uom === ''
              ? t('standingForm.qty')
              : t('standingForm.qtyIn', { unit: units.many(line.uom) })
          }
          required
          requiredLabel={required}
          error={problems.includes('qty') ? t('standingForm.qtyWrong') : undefined}
        >
          <Input
            inputMode="decimal"
            value={line.qty}
            onChange={(event) => onChange({ qty: event.target.value })}
          />
        </Field>
      </CardBody>
    </Card>
  );
}

/**
 * The schedule, the days and the lines of a standing order. Setting one up asks how often and from when;
 * a change keeps both, as the contract does, and says so.
 */
function StandingOrderFields({
  draft,
  onChange,
  problems,
  refused,
  editing,
}: {
  draft: StandingOrderDraft;
  onChange: (next: Partial<StandingOrderDraft>) => void;
  /** Shown once the person has tried to save. */
  problems: readonly DraftProblem[];
  /** The server's words for each field its last refusal pointed at (`refusedFields`). */
  refused: Partial<Record<RefusedField, string>>;
  editing: boolean;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const required = t('common:field.required');
  const has = (problem: DraftProblem) => problems.includes(problem);
  const weekly = draft.frequency === 'WEEKLY' || draft.frequency === 'FORTNIGHTLY';
  return (
    <>
      {editing ? (
        <p className="text-control-sm text-fg-muted">
          {draft.frequency === ''
            ? null
            : t('standingForm.frequencyFixed', {
                frequency: t(`standing.frequency.${draft.frequency}`),
              })}{' '}
          {t('standingForm.startsOnFixed', { day: draft.startsOn })}
        </p>
      ) : (
        <Field
          label={t('standingForm.frequency')}
          hint={t('standingForm.frequencyHint')}
          required
          requiredLabel={required}
          error={has('frequency') ? required : refused.frequency}
        >
          <Select
            value={draft.frequency}
            onValueChange={(value) => onChange({ frequency: value as Frequency })}
            placeholder={t('standingForm.chooseFrequency')}
            options={FREQUENCIES.map((frequency) => ({
              value: frequency,
              label: t(`standing.frequency.${frequency}`),
            }))}
          />
        </Field>
      )}
      {weekly ? (
        <FieldGroup
          label={t('standingForm.weekdays')}
          hint={draft.frequency === 'FORTNIGHTLY' ? t('standingForm.weekdaysHint') : undefined}
          required
          requiredLabel={required}
          error={has('weekdays') ? t('standingForm.weekdaysMissing') : refused.weekdays}
        >
          {WEEKDAYS.map((day) => (
            <Checkbox
              key={day}
              label={t(`standing.weekday.${day}`)}
              checked={draft.weekdays.includes(day)}
              onCheckedChange={(on) =>
                onChange({
                  weekdays:
                    on === true
                      ? [...draft.weekdays.filter((d) => d !== day), day]
                      : draft.weekdays.filter((d) => d !== day),
                })
              }
            />
          ))}
        </FieldGroup>
      ) : null}
      {draft.frequency === 'MONTHLY' ? (
        <Field
          label={t('standingForm.dayOfMonth')}
          hint={t('standingForm.dayOfMonthHint')}
          required
          requiredLabel={required}
          error={has('dayOfMonth') ? t('standingForm.dayOfMonthWrong') : refused.dayOfMonth}
        >
          <Input
            inputMode="numeric"
            value={draft.dayOfMonth}
            onChange={(event) => onChange({ dayOfMonth: event.target.value })}
          />
        </Field>
      ) : null}
      {draft.frequency === 'EVERY_N_DAYS' ? (
        <Field
          label={t('standingForm.intervalDays')}
          hint={t('standingForm.intervalDaysHint')}
          required
          requiredLabel={required}
          error={has('intervalDays') ? t('standingForm.intervalDaysWrong') : refused.intervalDays}
        >
          <Input
            inputMode="numeric"
            value={draft.intervalDays}
            onChange={(event) => onChange({ intervalDays: event.target.value })}
          />
        </Field>
      ) : null}
      {editing ? null : (
        <Field
          label={t('standingForm.startsOn')}
          hint={t('standingForm.startsOnHint')}
          required
          requiredLabel={required}
          error={has('startsOn') ? required : refused.startsOn}
        >
          <DatePicker
            value={draft.startsOn}
            onChange={(event) => onChange({ startsOn: event.target.value })}
          />
        </Field>
      )}
      <Field
        label={t('standingForm.endsOn')}
        hint={t('standingForm.endsOnHint')}
        error={has('endsOn') ? t('standingForm.endsOnKept') : refused.endsOn}
      >
        <DatePicker
          value={draft.endsOn}
          onChange={(event) => onChange({ endsOn: event.target.value })}
        />
      </Field>
      <StandingLinesEditor
        lines={draft.lines}
        onChange={(lines) => onChange({ lines })}
        checked={problems.length > 0}
      />
      {has('lines') ? (
        <p role="alert" className="text-critical-fg">
          {t('standingForm.linesMissing')}
        </p>
      ) : refused.lines === undefined ? null : (
        <p role="alert" className="text-critical-fg">
          {refused.lines}
        </p>
      )}
    </>
  );
}

/** Set up a standing order for a wholesale account (`createStandingOrder`). */
export function StandingOrderNewScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { customerId = '' } = useParams();
  const navigate = useNavigate();
  const keyFor = useIntentKey();
  const account = useApiQuery('getBusinessAccount', { path: { customerId } });
  const [draft, setDraft] = useState<StandingOrderDraft>(blankDraft);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const create = useApiMutation('createStandingOrder');
  const dirty =
    draft.frequency !== '' ||
    draft.startsOn !== '' ||
    draft.lines.some((line) => line.product !== null || line.qty !== '');
  const guard = useLeaveGuard(!saved && dirty);
  const labels = useStateLabels({
    loading: t('account.loading'),
    emptyTitle: t('account.notFound'),
    errorTitle: t('account.error'),
    deniedTitle: t('accounts.denied'),
  });
  const failure = useStateLabels({
    loading: t('standingForm.saving'),
    emptyTitle: t('standingForm.notSaved'),
    errorTitle: t('standingForm.notSaved'),
    deniedTitle: t('standingForm.denied'),
  });
  const problems = checked ? draftProblems(draft) : [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (draftProblems(draft).length > 0) return;
    const body = toCreateBody(customerId, draft);
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((order) => {
        setSaved(true);
        return navigate(orderHref(customerId, order.id));
      })
      .catch(() => undefined);
  };
  const back = (name: string) => (
    <Link to={accountHref(customerId)} className="text-accent-text underline">
      {t('back.account', { name })}
    </Link>
  );
  if (account.error?.status === 404) {
    return (
      <EmptyState
        title={t('account.notFound')}
        description={t('account.notFoundBody')}
        action={
          <Link to="/business-accounts" className="text-accent-text underline">
            {t('back.accounts')}
          </Link>
        }
      />
    );
  }
  return (
    <QueryBoundary
      query={account}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(a) => (
        <article aria-labelledby="standing-new-title" className="grid gap-4">
          {back(a.customer.name)}
          <PageHeader
            title={t('standingForm.newTitle', { name: a.customer.name })}
            titleId="standing-new-title"
            description={t('standingForm.intro')}
          />
          {a.status === 'CLOSED' ? (
            <Alert severity="critical" title={t('standingForm.accountClosed')} />
          ) : (
            <Card>
              <CardBody>
                <form className="grid gap-4" onSubmit={submit} noValidate>
                  <StandingOrderFields
                    draft={draft}
                    onChange={(next) => setDraft((now) => ({ ...now, ...next }))}
                    problems={problems}
                    refused={refusedFields(create.error?.details ?? [])}
                    editing={false}
                  />
                  <MutationFailure error={create.error} labels={failure} />
                  <div>
                    <Button
                      type="submit"
                      loading={create.isPending}
                      loadingLabel={t('standingForm.saving')}
                    >
                      {t('standingForm.save')}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}
          <LeaveGuardDialog guard={guard} />
        </article>
      )}
    </QueryBoundary>
  );
}

/**
 * One standing order (`getStandingOrder`): its schedule in words, its first and last days, the next run day
 * the server worked out, and the lines each run orders; changed, paused, resumed or ended by holders of
 * `whl.standing_order.manage`, each with its reason; and its runs, each with what happened and why.
 */
export function StandingOrderScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { id = '' } = useParams();
  const order = useApiQuery('getStandingOrder', { path: { id } });
  const words = useScheduleWords();
  const nextRun = useNextRun();
  const labels = useStateLabels({
    loading: t('standingOrder.loading'),
    emptyTitle: t('standingOrder.notFound'),
    errorTitle: t('standingOrder.error'),
    deniedTitle: t('standing.denied'),
  });
  if (order.error?.status === 404) {
    return (
      <EmptyState
        title={t('standingOrder.notFound')}
        description={t('standingOrder.notFoundBody')}
        action={
          <Link to="/business-accounts" className="text-accent-text underline">
            {t('back.accounts')}
          </Link>
        }
      />
    );
  }
  return (
    <QueryBoundary
      query={order}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(o) => (
        <article aria-labelledby="standing-order-title" className="grid gap-4">
          <Link to={accountHref(o.customer.id)} className="text-accent-text underline">
            {t('back.account', { name: o.customer.name })}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              title={t('standingOrder.title', { name: o.customer.name })}
              titleId="standing-order-title"
            />
            <StandingOrderStatusBadge status={o.status} />
          </div>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [t('standingOrder.facts.schedule'), scheduleWords(o, words)],
                    [t('standingOrder.facts.startsOn'), o.startsOn],
                    [t('standingOrder.facts.endsOn'), o.endsOn ?? t('standing.noEnd')],
                    [t('standingOrder.facts.nextRun'), nextRun(o)],
                    [t('standingOrder.facts.collection'), t('standingOrder.collected')],
                  ] satisfies [string, ReactNode][]
                ).map(([term, value]) => (
                  <div key={term} className="contents">
                    <dt className="text-fg-muted">{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <StandingOrderLines order={o} />
          <StandingOrderActions order={o} />
          <StandingOrderRuns id={o.id} />
        </article>
      )}
    </QueryBoundary>
  );
}

function StandingOrderLines({ order }: { order: StandingOrder }) {
  const { t } = useTranslation('wholesale');
  const units = useUnits();
  return (
    <section aria-labelledby="standing-order-lines-title" className="grid gap-2">
      <h2 id="standing-order-lines-title" className="text-heading-sm font-semibold">
        {t('standingOrder.lines')}
      </h2>
      <TableContainer aria-label={t('standingOrder.linesTable')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('standingOrder.columns.line')}</TableHead>
              <TableHead>{t('standingOrder.columns.product')}</TableHead>
              <TableHead numeric>{t('standingOrder.columns.qty')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((line) => (
              <TableRow key={line.id}>
                <TableRowHeader>{line.lineNo}</TableRowHeader>
                <TableCell label={t('standingOrder.columns.product')}>
                  {line.product.name}
                  <span className="block text-control-sm text-fg-muted">{line.product.sku}</span>
                </TableCell>
                <TableCell numeric label={t('standingOrder.columns.qty')}>
                  <QuantityDisplay
                    quantity={line.quantity}
                    unit={units.after(line.uom, line.quantity)}
                    places={units.places(line.uom)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}

type Done = 'saved' | 'paused' | 'resumed' | 'ended';
type Asking = 'pause' | 'resume' | 'end';

/** Change, pause, resume or end, each offered only in the state the contract allows it. */
function StandingOrderActions({ order: o }: { order: StandingOrder }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [draft, setDraft] = useState<StandingOrderDraft>(() => draftFromOrder(o));
  const [checked, setChecked] = useState(false);
  const update = useApiMutation('updateStandingOrder');
  const pause = useApiMutation('pauseStandingOrder');
  const resume = useApiMutation('resumeStandingOrder');
  const end = useApiMutation('endStandingOrder');
  // Only a change not saved yet holds the person back: the body it would send differs from the order's.
  const guard = useLeaveGuard(
    editing &&
      JSON.stringify(toUpdateBody(o, draft)) !== JSON.stringify(toUpdateBody(o, draftFromOrder(o))),
  );
  const failure = useStateLabels({
    loading: t('standingForm.saving'),
    emptyTitle: t('standingOrder.notChanged'),
    errorTitle: t('standingOrder.notChanged'),
    deniedTitle: t('standingOrder.denied'),
  });
  if (!auth.can('whl.standing_order.manage')) return null;
  const allowed = allowedActions(o.status);
  const removedEnd = o.endsOn !== null;
  const problems = checked ? draftProblems(draft, { removedEnd }) : [];
  const save = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (draftProblems(draft, { removedEnd }).length > 0) return;
    const input = { path: { id: o.id }, body: toUpdateBody(o, draft) };
    update
      .mutateAsync(input, { idempotencyKey: keyFor(input) })
      .then(() => {
        setEditing(false);
        setChecked(false);
        setDone('saved');
      })
      .catch(() => undefined);
  };
  const dialog = {
    pause: { mutation: pause, done: 'paused', destructive: false },
    resume: { mutation: resume, done: 'resumed', destructive: false },
    end: { mutation: end, done: 'ended', destructive: true },
  } as const;
  const name = o.customer.name;
  return (
    <div className="grid gap-3">
      {done === null ? null : <Alert severity="good" title={t(`standingOrder.outcome.${done}`)} />}
      {editing ? (
        <Card>
          <CardBody>
            <form
              className="grid gap-4"
              onSubmit={save}
              noValidate
              aria-label={t('standingForm.editTitle')}
            >
              <h2 className="text-heading-sm font-semibold">{t('standingForm.editTitle')}</h2>
              <StandingOrderFields
                draft={draft}
                onChange={(next) => setDraft((now) => ({ ...now, ...next }))}
                problems={problems}
                refused={refusedFields(update.error?.details ?? [])}
                editing
              />
              <MutationFailure error={shownFailure(update.error)} labels={failure} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  loading={update.isPending}
                  loadingLabel={t('standingForm.saving')}
                >
                  {t('standingForm.saveChange')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setChecked(false);
                    update.reset();
                  }}
                >
                  {t('standingForm.discard')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.edit ? (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(draftFromOrder(o));
                setDone(null);
                setEditing(true);
              }}
            >
              {t('standingOrder.edit')}
            </Button>
          ) : null}
          {allowed.pause ? (
            <Button variant="secondary" onClick={() => setAsking('pause')}>
              {t('standingOrder.pause')}
            </Button>
          ) : null}
          {allowed.resume ? (
            <Button variant="secondary" onClick={() => setAsking('resume')}>
              {t('standingOrder.resume')}
            </Button>
          ) : null}
          {allowed.end ? (
            <Button variant="danger" onClick={() => setAsking('end')}>
              {t('standingOrder.end')}
            </Button>
          ) : null}
        </div>
      )}
      {asking === null ? null : (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              dialog[asking].mutation.reset();
              setAsking(null);
            }
          }}
          title={t(`standingOrder.${asking}Title`, { name })}
          body={t(`standingOrder.${asking}Body`)}
          submitLabel={t(`standingOrder.${asking}`)}
          destructive={dialog[asking].destructive}
          error={shownFailure(dialog[asking].mutation.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: o.id }, body: { reason } };
            await dialog[asking].mutation.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setDone(dialog[asking].done);
            setAsking(null);
          }}
        />
      )}
      <LeaveGuardDialog guard={guard} />
    </div>
  );
}

/** Each run day of the order, newest first: what happened, why, and the order it made. */
function StandingOrderRuns({ id }: { id: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const pages = useCursorPages();
  const runs = useApiQuery('listStandingOrderRuns', {
    path: { id },
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useStateLabels({
    loading: t('runs.loading'),
    emptyTitle: t('runs.empty'),
    emptyDescription: t('runs.emptyBody'),
    errorTitle: t('runs.error'),
    deniedTitle: t('runs.denied'),
  });
  const view = useTableView<Run>([
    {
      id: 'runDate',
      rowHeader: true,
      head: t('runs.columns.runDate'),
      sortValue: (r) => r.runDate,
      cell: (r) => r.runDate,
    },
    {
      id: 'outcome',
      head: t('runs.columns.outcome'),
      sortValue: (r) => r.outcome,
      cell: (r) => (
        <span className="grid justify-items-start gap-1">
          <RunOutcomeBadge outcome={r.outcome} />
          {r.outcome === 'HELD_FOR_CREDIT' ? (
            <span className="text-control-sm text-fg-muted">{t('runs.heldHint')}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'reason',
      head: t('runs.columns.reason'),
      cell: (r) => r.reason ?? t('runs.noReason'),
    },
    {
      id: 'order',
      head: t('runs.columns.order'),
      cell: (r) => {
        if (r.order === null) return t('runs.noOrder');
        const name = r.order.number ?? t('quote.unnumberedOrder');
        const href = documentHref(r.order);
        return href === undefined ? (
          name
        ) : (
          <Link to={href} className="text-accent-text underline">
            {name}
          </Link>
        );
      },
    },
    {
      id: 'recordedAt',
      head: t('runs.columns.recordedAt'),
      sortValue: (r) => r.recordedAt,
      cell: (r) => formatDateTime(r.recordedAt),
    },
  ]);
  return (
    <section aria-labelledby="standing-runs-title" className="grid gap-2">
      <h2 id="standing-runs-title" className="text-heading-sm font-semibold">
        {t('runs.title')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('runs.intro')}</p>
      <TableCard
        view={view}
        query={runs}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.runDate}
        tableLabel={t('runs.table')}
        exportName={t('runs.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('runs.pages') }}
      />
    </section>
  );
}
