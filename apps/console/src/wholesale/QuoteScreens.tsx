import { FileSignature } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  DatePicker,
  EmptyState,
  Field,
  FilterMenu,
  IconChip,
  Input,
  MoneyDisplay,
  MoneyInput,
  MutationFailure,
  NOT_APPLICABLE,
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
  Textarea,
  formatDateTime,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useBranchScope } from '../branch/branchScope';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { dayEnd } from '../lib/dateRange';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { today } from '../payables/instant';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useUnits } from '../stock/units';
import { CustomerPicker } from './CustomerPicker';
import { QuoteLink } from './QuoteLink';
import {
  ISSUE_CHANNELS,
  QUOTE_STATUSES,
  QuoteStatusBadge,
  VersionStatusBadge,
  useQuoteName,
} from './presentation';
import {
  QuoteLinesEditor,
  blankQuoteLine,
  draftFromLine,
  lineProblems,
  toLineInput,
  type DraftQuoteLine,
} from './QuoteLinesEditor';

type S = components['schemas'];
type Quote = S['Quote'];
type Version = S['QuoteVersion'];

/** Quotes newest first: who for, by whom, their state and the API's total of the version in force. */
export function QuotesScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const quoteName = useQuoteName();
  const [status, setStatus] = useState(ANY);
  const list = useApiQuery('listQuotes', {
    query: {
      ...param('status', status),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('quotes.loading'),
    emptyTitle: t('quotes.empty'),
    emptyDescription: t('quotes.emptyBody'),
    errorTitle: t('quotes.error'),
    deniedTitle: t('quotes.denied'),
  });
  const view = useTableView<Quote>([
    {
      id: 'quote',
      rowHeader: true,
      head: t('columns.quote'),
      sortValue: (q) => q.quoteNo ?? '',
      cell: (q) => (
        <span className="flex items-center gap-3">
          <IconChip icon={FileSignature} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/quotes/${q.id}`} className="text-accent-text underline">
              {quoteName(q)}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {q.customer?.name ?? q.contactName}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (q) => q.status,
      cell: (q) => <QuoteStatusBadge status={q.status} />,
    },
    {
      id: 'version',
      head: t('columns.version'),
      sortValue: (q) => q.currentVersion.versionNo,
      cell: (q) =>
        t('quote.versionOf', { number: q.currentVersion.versionNo, count: q.versionCount }),
    },
    {
      id: 'validUntil',
      head: t('columns.validUntil'),
      sortValue: (q) => q.currentVersion.validUntil,
      cell: (q) => formatDateTime(q.currentVersion.validUntil),
    },
    {
      id: 'gross',
      head: t('columns.gross'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (q) => q.currentVersion.grossPesewas,
      cell: (q) => <MoneyDisplay pesewas={q.currentVersion.grossPesewas} />,
    },
  ]);
  return (
    <section aria-labelledby="quotes-title" className="grid gap-4">
      <PageHeader
        title={t('quotes.title')}
        titleId="quotes-title"
        description={<BranchScopeNote />}
        actions={
          auth.can('quo.quote.create') ? (
            <Button asChild>
              <Link to="/quotes/new">{t('quotes.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('quotes.title')}
        exportName={t('quotes.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('quotes.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                pages.reset();
              },
            }}
          >
            <FilterSelect
              anyLabel={t('filters.any')}
              label={t('filters.status')}
              value={status}
              onChange={(value) => {
                setStatus(value);
                pages.reset();
              }}
              options={QUOTE_STATUSES.map((s) => ({ value: s, label: t(`quoteStatus.${s}`) }))}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** The header of a quote being drafted: who for, how long it holds, its terms and the delivery fee. */
interface DraftHeader {
  customer: S['Customer'] | null;
  contactName: string;
  contactPhone: string;
  validUntil: string;
  terms: string;
  deliveryEstimate: string;
  deliveryFeePesewas: number | null;
  taxInclusive: boolean;
}

/** A phone as the contract takes it: +233 and nine digits. */
const PHONE = /^\+233\d{9}$/;

/**
 * A new quote for a buyer, typed from a phone or WhatsApp enquiry or from a request for quote (`?rfq=`).
 * Each line is priced by the API for this buyer (`resolvePrices`) before it is saved; the server works out
 * the line totals, the tax and the total, and whether the margin needs approval.
 */
export function QuoteNewScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const rfqId = search.get('rfq') ?? '';
  const scope = useBranchScope();
  const rfq = useApiQuery('getRfq', { path: { id: rfqId } }, { enabled: rfqId !== '' });
  const [header, setHeader] = useState<DraftHeader>({
    customer: null,
    contactName: '',
    contactPhone: '',
    validUntil: '',
    terms: '',
    deliveryEstimate: '',
    deliveryFeePesewas: null,
    taxInclusive: false,
  });
  const [lines, setLines] = useState<DraftQuoteLine[]>([blankQuoteLine()]);
  const [fromRfq, setFromRfq] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const create = useApiMutation('createQuote', { invalidates: ['listQuotes', 'listRfqs'] });
  const keyFor = useIntentKey();
  const guard = useLeaveGuard(
    !saved && (header.contactName !== '' || lines.some((line) => line.product !== null)),
  );
  // The request's contact and words fill the header once, when it arrives.
  if (rfq.data !== undefined && fromRfq !== rfq.data.id) {
    setFromRfq(rfq.data.id);
    setHeader((now) => ({
      ...now,
      contactName: rfq.data.contactName,
      contactPhone: rfq.data.contactPhone,
      deliveryEstimate: rfq.data.deliveryArea ?? now.deliveryEstimate,
    }));
  }
  const failure = useStateLabels({
    loading: t('builder.saving'),
    emptyTitle: t('builder.notSaved'),
    errorTitle: t('builder.notSaved'),
    deniedTitle: t('builder.denied'),
  });
  const branchId = scope.branchId ?? scope.branches[0]?.id ?? null;
  const headerWrong = headerProblems(header);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (headerWrong.length > 0 || lines.some((line) => lineProblems(line).length > 0)) return;
    const body: S['QuoteCreate'] = {
      ...(rfqId === '' ? {} : { rfqId }),
      ...(header.customer === null ? {} : { customerId: header.customer.id }),
      contactName: header.contactName.trim(),
      contactPhone: header.contactPhone.trim(),
      validUntil: dayEnd(header.validUntil),
      ...(header.terms.trim() === '' ? {} : { terms: header.terms.trim() }),
      ...(header.deliveryEstimate.trim() === ''
        ? {}
        : { deliveryEstimate: header.deliveryEstimate.trim() }),
      ...(header.deliveryFeePesewas === null
        ? {}
        : { deliveryFeePesewas: header.deliveryFeePesewas }),
      taxInclusive: header.taxInclusive,
      lines: lines.map(toLineInput),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => {
        setSaved(true);
        return navigate(`/quotes/${made.id}`);
      })
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="quote-new-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/quotes" className="text-accent-text underline">
          {t('back.quotes')}
        </Link>
        <PageHeader title={t('builder.title')} titleId="quote-new-title" />
        <p className="text-fg-muted">{t('builder.hint')}</p>
      </div>
      {rfq.data === undefined ? null : (
        <Alert severity="info" title={t('builder.fromRfq', { rfq: rfq.data.rfqNo ?? '' })}>
          <p className="whitespace-pre-line">{rfq.data.requirements}</p>
        </Alert>
      )}
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <MutationFailure error={create.error} labels={failure} />
        <Card>
          <CardBody className="grid gap-4">
            <QuoteHeaderFields
              header={header}
              onChange={(next) => setHeader((now) => ({ ...now, ...next }))}
              problems={checked ? headerWrong : []}
            />
          </CardBody>
        </Card>
        <QuoteLinesEditor
          lines={lines}
          onChange={setLines}
          customerId={header.customer?.id ?? null}
          branchId={branchId}
          checked={checked}
        />
        {checked && lines.some((line) => lineProblems(line).includes('price')) ? (
          <Alert severity="critical" title={t('builder.pricesMissing')}>
            {t('builder.pricesMissingBody')}
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={create.isPending} loadingLabel={t('builder.saving')}>
            {t('builder.save')}
          </Button>
        </div>
      </form>
      <LeaveGuardDialog guard={guard} />
    </article>
  );
}

type HeaderProblem = 'contactName' | 'contactPhone' | 'validUntil';

function headerProblems(header: DraftHeader): HeaderProblem[] {
  const problems: HeaderProblem[] = [];
  if (header.contactName.trim() === '') problems.push('contactName');
  if (!PHONE.test(header.contactPhone.trim())) problems.push('contactPhone');
  if (header.validUntil === '' || header.validUntil < today()) problems.push('validUntil');
  return problems;
}

function QuoteHeaderFields({
  header,
  onChange,
  problems,
}: {
  header: DraftHeader;
  onChange: (next: Partial<DraftHeader>) => void;
  problems: HeaderProblem[];
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const required = t('common:field.required');
  return (
    <>
      <CustomerPicker
        label={t('fields.customer')}
        hint={t('fields.customerHint')}
        value={header.customer}
        onChange={(customer) =>
          onChange({
            customer,
            ...(customer === null
              ? {}
              : {
                  contactName: header.contactName === '' ? customer.name : header.contactName,
                  contactPhone:
                    header.contactPhone === '' ? (customer.phone ?? '') : header.contactPhone,
                }),
          })
        }
      />
      <Field
        label={t('fields.contactName')}
        required
        requiredLabel={required}
        error={problems.includes('contactName') ? required : undefined}
      >
        <Input
          value={header.contactName}
          maxLength={120}
          onChange={(event) => onChange({ contactName: event.target.value })}
        />
      </Field>
      <Field
        label={t('fields.contactPhone')}
        hint={t('fields.contactPhoneHint')}
        required
        requiredLabel={required}
        error={problems.includes('contactPhone') ? t('fields.contactPhoneWrong') : undefined}
      >
        <Input
          type="tel"
          inputMode="tel"
          value={header.contactPhone}
          onChange={(event) => onChange({ contactPhone: event.target.value })}
        />
      </Field>
      <Field
        label={t('fields.validUntil')}
        hint={t('fields.validUntilHint')}
        required
        requiredLabel={required}
        error={problems.includes('validUntil') ? t('fields.validUntilWrong') : undefined}
      >
        <DatePicker
          value={header.validUntil}
          onChange={(event) => onChange({ validUntil: event.target.value })}
        />
      </Field>
      <Field label={t('fields.terms')} hint={t('fields.termsHint')}>
        <Textarea
          value={header.terms}
          maxLength={1000}
          onChange={(event) => onChange({ terms: event.target.value })}
        />
      </Field>
      <Field label={t('fields.deliveryEstimate')} hint={t('fields.deliveryEstimateHint')}>
        <Input
          value={header.deliveryEstimate}
          maxLength={200}
          onChange={(event) => onChange({ deliveryEstimate: event.target.value })}
        />
      </Field>
      <Field label={t('fields.deliveryFee')} hint={t('fields.deliveryFeeHint')}>
        <MoneyInput
          value={header.deliveryFeePesewas}
          onValueChange={(pesewas) => onChange({ deliveryFeePesewas: pesewas })}
        />
      </Field>
      <Field label={t('fields.taxInclusive')} hint={t('fields.taxInclusiveHint')}>
        <Checkbox
          checked={header.taxInclusive}
          onCheckedChange={(on) => onChange({ taxInclusive: on === true })}
        />
      </Field>
    </>
  );
}

/**
 * One quote: the version in force, or an older one (`?version=`), read as it was issued, and what can be
 * done next. Every issued version stays readable: a revision is a new version, never an edit of the old.
 */
export function QuoteScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { id = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const quoteName = useQuoteName();
  const quote = useApiQuery('getQuote', { path: { id } });
  const versions = useApiAllPages('listQuoteVersions', { path: { id }, query: { limit: 100 } });
  const labels = useStateLabels({
    loading: t('quote.loading'),
    emptyTitle: t('quote.notFound'),
    errorTitle: t('quote.error'),
    deniedTitle: t('quotes.denied'),
  });
  const back = (
    <Link to="/quotes" className="text-accent-text underline">
      {t('back.quotes')}
    </Link>
  );
  if (quote.error?.status === 404) {
    return (
      <EmptyState
        title={t('quote.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={quote}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(q) => {
        const all = [...(versions.data?.items ?? [])].sort((a, b) => b.versionNo - a.versionNo);
        const chosen = search.get('version');
        const shown =
          (chosen === null ? undefined : all.find((v) => v.id === chosen)) ?? q.currentVersion;
        const current = shown.id === q.currentVersion.id;
        return (
          <article aria-labelledby="quote-title" className="grid gap-4">
            {back}
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader title={quoteName(q)} titleId="quote-title" />
              <QuoteStatusBadge status={q.status} />
            </div>
            <Card>
              <CardBody>
                <Facts
                  rows={[
                    [
                      t('fields.customer'),
                      q.customer === null ? (
                        t('quote.noCustomer')
                      ) : (
                        <span key="c">
                          {q.customer.name} <ReadableId value={q.customer.publicId} />
                        </span>
                      ),
                    ],
                    [t('fields.contact'), `${q.contactName}, ${q.contactPhone}`],
                    [t('fields.salesperson'), q.salesperson.displayName],
                    [
                      t('fields.request'),
                      q.rfqId === null ? (
                        NOT_APPLICABLE
                      ) : (
                        <Link
                          key="r"
                          to={`/rfqs/${q.rfqId}`}
                          className="text-accent-text underline"
                        >
                          {t('quote.openRfq')}
                        </Link>
                      ),
                    ],
                    [
                      t('fields.order'),
                      q.convertedOrder === null ? (
                        NOT_APPLICABLE
                      ) : (
                        <Link
                          key="o"
                          to={`/orders/${q.convertedOrder.id}`}
                          className="text-accent-text underline"
                        >
                          {q.convertedOrder.number ?? t('quote.unnumberedOrder')}
                        </Link>
                      ),
                    ],
                    ...(q.declineReason === null
                      ? []
                      : ([[t('fields.declineReason'), q.declineReason]] satisfies [
                          string,
                          ReactNode,
                        ][])),
                  ]}
                />
              </CardBody>
            </Card>
            <VersionHistory
              versions={all}
              shownId={shown.id}
              currentId={q.currentVersion.id}
              loading={versions.isPending}
              onShow={(versionId) =>
                setSearch(versionId === q.currentVersion.id ? {} : { version: versionId })
              }
            />
            <VersionView version={shown} current={current} />
            {current ? <QuoteActions quote={q} /> : null}
          </article>
        );
      }}
    </QueryBoundary>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-fg-muted">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every version of the quote, newest first; each opens as it was. */
function VersionHistory({
  versions,
  shownId,
  currentId,
  loading,
  onShow,
}: {
  versions: Version[];
  shownId: string;
  currentId: string;
  loading: boolean;
  onShow: (versionId: string) => void;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  if (loading) return <Skeleton label={t('versions.loading')} shape="block" className="h-16" />;
  if (versions.length < 2) return null;
  return (
    <nav aria-labelledby="versions-title" className="grid gap-2">
      <h2 id="versions-title" className="text-heading-sm font-semibold">
        {t('versions.title')}
      </h2>
      <ul className="grid gap-2">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2">
            <Button
              variant={v.id === shownId ? 'primary' : 'secondary'}
              size="sm"
              aria-current={v.id === shownId ? 'true' : undefined}
              onClick={() => onShow(v.id)}
            >
              {v.id === currentId
                ? t('versions.current', { number: v.versionNo })
                : t('versions.older', { number: v.versionNo })}
            </Button>
            <VersionStatusBadge status={v.status} />
            {v.changeNote === null ? null : (
              <span className="text-control-sm text-fg-muted">{v.changeNote}</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One version: its lines at the API's prices, its totals, its margin and how it was accepted. */
function VersionView({ version: v, current }: { version: Version; current: boolean }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const units = useUnits();
  return (
    <section aria-labelledby="version-title" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="version-title" className="text-heading-sm font-semibold">
          {t('version.title', { number: v.versionNo })}
        </h2>
        <VersionStatusBadge status={v.status} />
      </div>
      {current ? null : (
        <Alert severity="info" title={t('version.olderTitle')}>
          {t('version.olderBody')}
        </Alert>
      )}
      {!v.belowMarginFloor ? null : v.status === 'APPROVED' ? (
        <Alert severity="info" title={t('version.belowFloorApproved')}>
          {t('version.belowFloorApprovedBody')}
        </Alert>
      ) : (
        <Alert severity="warning" title={t('version.belowFloor')}>
          {t('version.belowFloorBody')}
        </Alert>
      )}
      <Card>
        <CardBody>
          <Facts
            rows={[
              [t('fields.validUntil'), formatDateTime(v.validUntil)],
              ...(v.changeNote === null
                ? []
                : ([[t('fields.changeNote'), v.changeNote]] satisfies [string, ReactNode][])),
              [
                t('fields.made'),
                t('version.issuedBy', {
                  who: v.createdBy.displayName,
                  when: formatDateTime(v.createdAt),
                }),
              ],
              [
                t('fields.issued'),
                v.issuedAt === null || v.issuedBy === null
                  ? t('version.notIssued')
                  : t('version.issuedBy', {
                      who: v.issuedBy.displayName,
                      when: formatDateTime(v.issuedAt),
                    }),
              ],
              [t('fields.terms'), v.terms ?? NOT_APPLICABLE],
              [t('fields.deliveryEstimate'), v.deliveryEstimate ?? NOT_APPLICABLE],
              ...(v.acceptance === null
                ? []
                : ([
                    [
                      t('fields.acceptance'),
                      t('version.acceptedBy', {
                        who: v.acceptance.acceptedName,
                        how: t(`acceptanceMethod.${v.acceptance.method}`),
                        when: formatDateTime(v.acceptance.acceptedAt),
                      }),
                    ],
                  ] satisfies [string, ReactNode][])),
            ]}
          />
        </CardBody>
      </Card>
      <TableContainer aria-label={t('version.lines')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.line')}</TableHead>
              <TableHead numeric>{t('columns.qty')}</TableHead>
              <TableHead numeric>{t('columns.apiPrice')}</TableHead>
              <TableHead numeric>{t('columns.agreedPrice')}</TableHead>
              <TableHead numeric>{t('columns.lineNet')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.lines.map((line) => (
              <TableRow key={line.id}>
                <TableRowHeader>{line.description}</TableRowHeader>
                <TableCell numeric label={t('columns.qty')}>
                  <QuantityDisplay
                    quantity={line.quantity}
                    unit={units.after(line.uom, line.quantity)}
                    places={units.places(line.uom)}
                  />
                </TableCell>
                <TableCell numeric label={t('columns.apiPrice')}>
                  {line.resolvedUnitPricePesewas === null ? (
                    t('version.noApiPrice')
                  ) : (
                    <MoneyDisplay pesewas={line.resolvedUnitPricePesewas} />
                  )}
                </TableCell>
                <TableCell numeric label={t('columns.agreedPrice')}>
                  {`${t('lines.per', { unit: units.one(line.uom) })} `}
                  <MoneyDisplay pesewas={line.unitPricePesewas} />
                </TableCell>
                <TableCell numeric label={t('columns.lineNet')}>
                  <MoneyDisplay pesewas={line.lineNetPesewas} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Card>
        <CardBody>
          <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
            <dt>{t('totals.deliveryFee')}</dt>
            <dd className="text-end">
              <MoneyDisplay pesewas={v.deliveryFeePesewas} />
            </dd>
            <dt>{v.taxInclusive ? t('totals.netInclusive') : t('totals.net')}</dt>
            <dd className="text-end">
              <MoneyDisplay pesewas={v.netPesewas} />
            </dd>
            <dt>{t('totals.tax')}</dt>
            <dd className="text-end">
              <MoneyDisplay pesewas={v.taxPesewas} />
            </dd>
            <dt className="font-semibold">{t('totals.gross')}</dt>
            <dd className="text-end">
              <MoneyDisplay pesewas={v.grossPesewas} strong />
            </dd>
            {/* 2.29.0: markup is over cost and margin over the selling price, each the API's figure;
                the deprecated `marginPercent` (markup under the old name) is never read. */}
            <dt>{t('totals.markup')}</dt>
            <dd className="text-end">
              {v.markupPercent === null
                ? t('totals.notKnown')
                : t('totals.percent', { value: v.markupPercent })}
            </dd>
            <dt>{t('totals.marginOverPrice')}</dt>
            <dd className="text-end">
              {v.marginOverPricePercent === null
                ? t('totals.notKnown')
                : t('totals.percent', { value: v.marginOverPricePercent })}
            </dd>
          </dl>
        </CardBody>
      </Card>
    </section>
  );
}

type Open =
  | 'edit'
  | 'issue'
  | 'issueApproved'
  | 'link'
  | 'revise'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'convert'
  | null;
type Outcome =
  | { kind: 'saved' | 'revised' | 'accepted' | 'declined' | 'cancelled' }
  /** Issued, or a new link made: the link's token, answered only this once (null if the server gave none). */
  | { kind: 'issued' | 'newLink'; token: string | null }
  | { kind: 'margin'; approvalId: string }
  | { kind: 'converted'; order: S['SalesOrder'] };

/** What can be done to the quote next, by its state and the person's permissions. */
function QuoteActions({ quote: q }: { quote: Quote }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const quoteName = useQuoteName();
  const [open, setOpen] = useState<Open>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Each new link is its own intent: asking again for an issued version answers a fresh token.
  const [links, setLinks] = useState(0);
  const after = { invalidates: ['listQuotes', 'getQuote', 'listQuoteVersions'] } as const;
  const issue = useApiMutation('issueQuoteVersion', after);
  const revise = useApiMutation('reviseQuote', after);
  const accept = useApiMutation('recordQuoteAcceptance', after);
  const decline = useApiMutation('declineQuote', after);
  const cancel = useApiMutation('cancelQuote', after);
  const convert = useApiMutation('convertQuote', after);
  const failure = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  const v = q.currentVersion;
  const draft = v.status === 'DRAFT';
  // 2.19.0 (CR-058): a margin approval only approves. The version waits for someone other than its approver
  // to issue it at the figures approved; the quote still reads DRAFT.
  const approved = v.status === 'APPROVED';
  const live = q.status === 'ISSUED' && v.status === 'ISSUED';
  const canEdit = draft && auth.can('quo.quote.create');
  const canIssue = draft && auth.can('quo.quote.issue');
  const canIssueApproved = approved && auth.can('quo.quote.issue');
  const canRevise =
    (q.status === 'ISSUED' || q.status === 'EXPIRED' || q.status === 'DECLINED') &&
    !draft &&
    auth.can('quo.quote.create');
  const canRecord = live && auth.can('quo.quote.issue');
  const canLink = live && auth.can('quo.quote.issue');
  const canConvert =
    q.status === 'ACCEPTED' && q.convertedOrder === null && auth.can('quo.quote.convert');
  const canCancel =
    q.status !== 'CONVERTED' &&
    q.status !== 'CANCELLED' &&
    q.status !== 'ACCEPTED' &&
    auth.can('quo.quote.issue');
  const totals = (
    <p>
      {t('totals.gross')}: <MoneyDisplay pesewas={v.grossPesewas} strong />
    </p>
  );
  return (
    <div className="grid gap-3">
      {outcome === null ? null : <OutcomeAlert outcome={outcome} name={quoteName(q)} />}
      {(outcome?.kind === 'issued' || outcome?.kind === 'newLink') && outcome.token !== null ? (
        <QuoteLink
          token={outcome.token}
          phone={q.contactPhone}
          contactName={q.contactName}
          quoteNo={q.quoteNo ?? quoteName(q)}
        />
      ) : null}
      {q.status === 'PENDING_APPROVAL' && v.approvalRequestId !== null && outcome === null ? (
        <Alert severity="warning" title={t('outcome.marginWaiting')}>
          <Link to={`/approvals/${v.approvalRequestId}`} className="text-accent-text underline">
            {t('outcome.openApproval')}
          </Link>
        </Alert>
      ) : null}
      {approved && outcome === null ? (
        <Alert severity="info" title={t('outcome.approved', { number: v.versionNo })}>
          <p>{t('outcome.approvedBody')}</p>
          {v.approvalRequestId === null ? null : (
            <Link to={`/approvals/${v.approvalRequestId}`} className="text-accent-text underline">
              {t('outcome.openApproval')}
            </Link>
          )}
        </Alert>
      ) : null}
      {open === null ? (
        <>
          <MutationFailure error={shownFailure(issue.error)} labels={failure} />
          <MutationFailure error={shownFailure(convert.error)} labels={failure} />
        </>
      ) : null}
      {open === 'edit' ? (
        <EditDraft
          quote={q}
          onDone={() => {
            setOpen(null);
            setOutcome({ kind: 'saved' });
          }}
          onCancel={() => setOpen(null)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button variant="secondary" onClick={() => setOpen('edit')}>
              {t('actions.edit')}
            </Button>
          ) : null}
          {canIssue ? (
            <Button
              onClick={() => {
                issue.reset();
                setOpen('issue');
              }}
            >
              {t('actions.issue')}
            </Button>
          ) : null}
          {canIssueApproved ? (
            <Button
              onClick={() => {
                issue.reset();
                setOpen('issueApproved');
              }}
            >
              {t('actions.issueApproved')}
            </Button>
          ) : null}
          {canRevise ? (
            <Button variant="secondary" onClick={() => setOpen('revise')}>
              {t('actions.revise')}
            </Button>
          ) : null}
          {canLink ? (
            <Button
              variant="secondary"
              onClick={() => {
                issue.reset();
                setOpen('link');
              }}
            >
              {t('link.make')}
            </Button>
          ) : null}
          {canRecord ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  accept.reset();
                  setOpen('accept');
                }}
              >
                {t('actions.recordAcceptance')}
              </Button>
              <Button variant="secondary" onClick={() => setOpen('decline')}>
                {t('actions.recordDecline')}
              </Button>
            </>
          ) : null}
          {canConvert ? (
            <Button
              onClick={() => {
                convert.reset();
                setOpen('convert');
              }}
            >
              {t('actions.convert')}
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="secondary" onClick={() => setOpen('cancel')}>
              {t('actions.cancel')}
            </Button>
          ) : null}
        </div>
      )}
      <IssueDialog
        open={open === 'issue' || open === 'issueApproved'}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        pending={issue.isPending}
        error={shownFailure(issue.error)}
        title={
          approved
            ? t('actions.issueApprovedTitle', { name: quoteName(q), number: v.versionNo })
            : t('actions.issueTitle', { name: quoteName(q), number: v.versionNo })
        }
        body={approved ? t('actions.issueApprovedBody') : t('actions.issueBody')}
        confirmLabel={approved ? t('actions.issueApproved') : t('actions.issue')}
        onIssue={(channels) => {
          // The same call issues a draft and an approved version (2.19.0); only its approver is refused
          // (APPROVER_CANNOT_ISSUE), and the refusal stays in the dialog and on the page in words.
          const input = { path: { id: v.id }, body: { channels } };
          issue
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then((answer) => {
              setOpen(null);
              setOutcome(
                isApprovalPending(answer)
                  ? { kind: 'margin', approvalId: answer.approvalRequestId }
                  : { kind: 'issued', token: answer.acceptanceLinkToken },
              );
            })
            .catch(() => undefined);
        }}
      >
        {totals}
      </IssueDialog>
      <ConfirmDialog
        open={open === 'link'}
        onOpenChange={(next) => setOpen(next ? 'link' : null)}
        title={t('link.makeTitle', { name: quoteName(q) })}
        body={t('link.makeBody')}
        confirmLabel={t('link.make')}
        pendingLabel={t('actions.working')}
        pending={issue.isPending}
        error={shownFailure(issue.error)}
        failedTitle={t('link.notMade')}
        onConfirm={() => {
          // Nothing is sent again (2.12.0): the server answers a fresh token for the issued version.
          const input = { path: { id: v.id }, body: { channels: [] } };
          issue
            .mutateAsync(input, { idempotencyKey: keyFor({ newLink: v.id, count: links }) })
            .then((answer) => {
              setLinks((n) => n + 1);
              setOpen(null);
              if (!isApprovalPending(answer)) {
                setOutcome({ kind: 'newLink', token: answer.acceptanceLinkToken });
              }
            })
            .catch(() => undefined);
        }}
      />
      {open === 'revise' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('actions.reviseTitle', { name: quoteName(q) })}
          body={t('actions.reviseBody', { number: v.versionNo })}
          submitLabel={t('actions.revise')}
          error={shownFailure(revise.error)}
          failureLabels={failure}
          onConfirm={async (changeNote) => {
            const input = { path: { id: q.id }, body: { changeNote, copyFromVersionId: v.id } };
            await revise.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'revised' });
            setOpen(null);
          }}
        />
      ) : null}
      <AcceptanceDialog
        open={open === 'accept'}
        onOpenChange={(next) => setOpen(next ? 'accept' : null)}
        pending={accept.isPending}
        error={shownFailure(accept.error)}
        title={t('actions.acceptTitle', { name: quoteName(q), number: v.versionNo })}
        onRecord={(body) => {
          const input = { path: { id: q.id }, body };
          accept
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then(() => {
              setOpen(null);
              setOutcome({ kind: 'accepted' });
            })
            .catch(() => undefined);
        }}
      >
        {totals}
      </AcceptanceDialog>
      {open === 'decline' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('actions.declineTitle', { name: quoteName(q) })}
          body={t('actions.declineBody')}
          submitLabel={t('actions.recordDecline')}
          error={shownFailure(decline.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: q.id }, body: { reason } };
            await decline.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'declined' });
            setOpen(null);
          }}
        />
      ) : null}
      {open === 'cancel' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('actions.cancelTitle', { name: quoteName(q) })}
          body={t('actions.cancelBody')}
          submitLabel={t('actions.cancel')}
          destructive
          error={shownFailure(cancel.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: q.id }, body: { reason } };
            await cancel.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'cancelled' });
            setOpen(null);
          }}
        />
      ) : null}
      <ConvertDialog
        open={open === 'convert'}
        onOpenChange={(next) => setOpen(next ? 'convert' : null)}
        pending={convert.isPending}
        error={shownFailure(convert.error)}
        title={t('actions.convertTitle', { name: quoteName(q) })}
        onConvert={(body) => {
          const input = { path: { id: q.id }, body };
          convert
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then((order) => {
              setOpen(null);
              setOutcome({ kind: 'converted', order });
            })
            .catch(() => undefined);
        }}
      >
        {totals}
      </ConvertDialog>
    </div>
  );
}

function OutcomeAlert({ outcome, name }: { outcome: Outcome; name: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  if (outcome.kind === 'margin') {
    return (
      <Alert severity="warning" title={t('outcome.margin', { name })}>
        <Link to={`/approvals/${outcome.approvalId}`} className="text-accent-text underline">
          {t('outcome.openApproval')}
        </Link>
      </Alert>
    );
  }
  if (outcome.kind === 'converted') {
    return (
      <Alert
        severity="good"
        title={t('outcome.converted', { name, order: outcome.order.orderNo ?? '' })}
      >
        <Link to={`/orders/${outcome.order.id}`} className="text-accent-text underline">
          {t('outcome.openOrder')}
        </Link>
      </Alert>
    );
  }
  return <Alert severity="good" title={t(`outcome.${outcome.kind}`, { name })} />;
}

/** The draft version's lines, edited and sent back whole (`updateQuoteVersion`). */
function EditDraft({
  quote: q,
  onDone,
  onCancel,
}: {
  quote: Quote;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const scope = useBranchScope();
  const keyFor = useIntentKey();
  const v = q.currentVersion;
  const update = useApiMutation('updateQuoteVersion', {
    invalidates: ['getQuote', 'listQuoteVersions', 'listQuotes'],
  });
  const [lines, setLines] = useState<DraftQuoteLine[]>(
    v.lines.length === 0 ? [blankQuoteLine()] : v.lines.map(draftFromLine),
  );
  const [validUntil, setValidUntil] = useState(v.validUntil.slice(0, 10));
  const [fee, setFee] = useState<number | null>(v.deliveryFeePesewas);
  const [checked, setChecked] = useState(false);
  const failure = useStateLabels({
    loading: t('builder.saving'),
    emptyTitle: t('builder.notSaved'),
    errorTitle: t('builder.notSaved'),
    deniedTitle: t('builder.denied'),
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (validUntil === '' || lines.some((line) => lineProblems(line).length > 0)) return;
    const input = {
      path: { id: v.id },
      body: {
        // The draft version's own lock (2.12.0), not the quote's.
        version: v.version,
        validUntil: dayEnd(validUntil),
        ...(fee === null ? {} : { deliveryFeePesewas: fee }),
        lines: lines.map(toLineInput),
      },
    };
    update
      .mutateAsync(input, { idempotencyKey: keyFor(input) })
      .then(onDone)
      .catch(() => undefined);
  };
  return (
    <form className="grid gap-4" onSubmit={save} noValidate aria-labelledby="edit-title">
      <h2 id="edit-title" className="text-heading-sm font-semibold">
        {t('edit.title', { number: v.versionNo })}
      </h2>
      <MutationFailure error={update.error} labels={failure} />
      <Field
        label={t('fields.validUntil')}
        required
        requiredLabel={t('common:field.required')}
        error={checked && validUntil === '' ? t('fields.validUntilWrong') : undefined}
      >
        <DatePicker value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
      </Field>
      <Field label={t('fields.deliveryFee')} hint={t('fields.deliveryFeeHint')}>
        <MoneyInput value={fee} onValueChange={setFee} />
      </Field>
      <QuoteLinesEditor
        lines={lines}
        onChange={setLines}
        customerId={q.customer?.id ?? null}
        branchId={q.branchId ?? scope.branchId}
        checked={checked}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={update.isPending} loadingLabel={t('builder.saving')}>
          {t('edit.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('edit.discard')}
        </Button>
      </div>
    </form>
  );
}

type Channel = (typeof ISSUE_CHANNELS)[number];

/** Issuing sends the acceptance link by the channels chosen; the server makes the link and its token. */
function IssueDialog({
  open,
  onOpenChange,
  pending,
  error,
  title,
  body,
  confirmLabel,
  onIssue,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: ReturnType<typeof shownFailure>;
  title: string;
  body: string;
  confirmLabel: string;
  onIssue: (channels: Channel[]) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const [channels, setChannels] = useState<Channel[]>(['WHATSAPP', 'SMS']);
  const [checked, setChecked] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      pendingLabel={t('actions.issuing')}
      pending={pending}
      error={error}
      failedTitle={t('actions.notIssued')}
      onConfirm={() => {
        setChecked(true);
        if (channels.length > 0) onIssue(channels);
      }}
    >
      {children}
      <fieldset className="grid gap-2">
        <legend className="font-semibold">{t('actions.channels')}</legend>
        {ISSUE_CHANNELS.map((channel) => (
          <Field key={channel} label={t(`channel.${channel}`)}>
            <Checkbox
              checked={channels.includes(channel)}
              onCheckedChange={(on) =>
                setChannels((now) =>
                  on === true ? [...now, channel] : now.filter((c) => c !== channel),
                )
              }
            />
          </Field>
        ))}
        {checked && channels.length === 0 ? (
          <p role="alert" className="text-critical-fg">
            {t('actions.channelsNone')}
          </p>
        ) : null}
      </fieldset>
    </ConfirmDialog>
  );
}

/** An acceptance given in person or by phone, recorded by staff with the buyer's name. */
function AcceptanceDialog({
  open,
  onOpenChange,
  pending,
  error,
  title,
  onRecord,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: ReturnType<typeof shownFailure>;
  title: string;
  onRecord: (body: S['QuoteAcceptanceRecord']) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const [method, setMethod] = useState<S['QuoteAcceptanceRecord']['method']>('PHONE_CONFIRMED');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      body={t('actions.acceptBody')}
      confirmLabel={t('actions.recordAcceptance')}
      pendingLabel={t('actions.working')}
      pending={pending}
      error={error}
      failedTitle={t('actions.failed')}
      onConfirm={() => {
        setChecked(true);
        if (name.trim() !== '' && note.trim() !== '') {
          onRecord({ method, acceptedName: name.trim(), note: note.trim() });
        }
      }}
    >
      {children}
      <Field label={t('fields.acceptanceMethod')}>
        <Select
          value={method}
          onValueChange={(value) => setMethod(value as S['QuoteAcceptanceRecord']['method'])}
          options={(['PHONE_CONFIRMED', 'IN_PERSON'] as const).map((m) => ({
            value: m,
            label: t(`acceptanceMethod.${m}`),
          }))}
        />
      </Field>
      <Field
        label={t('fields.acceptedName')}
        required
        requiredLabel={t('common:field.required')}
        error={checked && name.trim() === '' ? t('common:field.required') : undefined}
      >
        <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </Field>
      {/* The evidence of the acceptance, which the server requires (2.12.0, NOTE_REQUIRED). */}
      <Field
        label={t('fields.acceptanceNote')}
        hint={t('fields.acceptanceNoteHint')}
        required
        requiredLabel={t('common:field.required')}
        error={checked && note.trim() === '' ? t('common:field.required') : undefined}
      >
        <Textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

/**
 * An accepted quote becomes exactly one order (`convertQuote`): its lines carry the quote line as their
 * price, and the invoice later carries the order, so every link is kept. A credit order is checked against
 * the buyer's limit and terms when it is confirmed, on the order's page.
 */
function ConvertDialog({
  open,
  onOpenChange,
  pending,
  error,
  title,
  onConvert,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: ReturnType<typeof shownFailure>;
  title: string;
  onConvert: (body: S['QuoteConvert']) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const [mode, setMode] = useState<S['QuoteConvert']['fulfilmentMode']>('COLLECTION');
  const [terms, setTerms] = useState<S['QuoteConvert']['paymentTerms']>('CREDIT');
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      body={t('actions.convertBody')}
      confirmLabel={t('actions.convert')}
      pendingLabel={t('actions.working')}
      pending={pending}
      error={error}
      failedTitle={t('actions.notConverted')}
      onConfirm={() => onConvert({ fulfilmentMode: mode, paymentTerms: terms })}
    >
      {children}
      <Field label={t('fields.fulfilment')}>
        <Select
          value={mode}
          onValueChange={(value) => setMode(value as S['QuoteConvert']['fulfilmentMode'])}
          options={(['COLLECTION', 'DELIVERY'] as const).map((m) => ({
            value: m,
            label: t(`fulfilment.${m}`),
          }))}
        />
      </Field>
      <Field label={t('fields.paymentTerms')} hint={t('fields.paymentTermsHint')}>
        <Select
          value={terms}
          onValueChange={(value) => setTerms(value as S['QuoteConvert']['paymentTerms'])}
          options={(['CREDIT', 'COD', 'PREPAID'] as const).map((m) => ({
            value: m,
            label: t(`paymentTerms.${m}`),
          }))}
        />
      </Field>
    </ConfirmDialog>
  );
}
