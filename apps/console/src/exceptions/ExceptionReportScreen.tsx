import { CircleCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DatePicker,
  Field,
  MoneyDisplay,
  QueryBoundary,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  formatDateTime,
  type StatusTone,
  type DateString,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { lookup } from '../lib/lookup';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { accraToday } from '../reports/period';
import {
  exceptionReviewOn,
  reviewOf,
  useReviewException,
  type ExceptionReview,
} from '../requested/exceptionReview';
import { byUrgency, recordPath } from './records';

type Schemas = components['schemas'];
type Report = Schemas['DailyExceptionReport'];
type Item = Schemas['ExceptionItem'];
type RateByUser = Schemas['RateByUser'];

const SEVERITY_TONE: Record<Item['severity'], StatusTone> = {
  URGENT: 'critical',
  REVIEW: 'warning',
  INFO: 'info',
};

/** The per-person groups of the report, in the order the owner reads them. */
const PATTERNS = [
  'voidsByCashier',
  'overridesByUser',
  'refundsByUser',
  'shiftOverShort',
  'driverVariances',
  'mortalityByHandler',
  'adjustmentsByUser',
  'exportsByUser',
] as const satisfies readonly (keyof Report)[];

/** A kind's name; a kind this build does not know yet shows its code (the contract can gain kinds). */
function useKindName() {
  const { t } = useTranslation('exceptions');
  return (kind: string) => t(`kind.${kind}` as 'kind.SALE_VOID', { defaultValue: kind });
}

/**
 * The daily exception report (FR-RPT, the threat model's detection side): for one business day and the
 * header's branch, every item a control raised, urgent first, each with its severity, branch, who and when,
 * the amount and a link to the record behind it; what each control raised; and who did what how often
 * against their role's average. An Owner or a Manager marks an item reviewed with a note (CR-059). Every
 * figure, count and rate is the API's; the screen only orders the items.
 */
export function ExceptionReportScreen() {
  const { t } = useTranslation(['exceptions', 'common']);
  const scope = useBranchScope();
  const [day, setDay] = useState<DateString>(accraToday());
  const report = useApiQuery('getDailyExceptionReport', { query: { date: day, ...scope.query } });
  const labels = useStateLabels({
    loading: t('loading'),
    emptyTitle: t('empty'),
    emptyDescription: t('emptyBody'),
    errorTitle: t('error'),
    deniedTitle: t('denied'),
    deniedDescription: t('deniedBody'),
  });
  return (
    <section aria-labelledby="exceptions-title" className="grid gap-4">
      <PageHeader title={t('title')} titleId="exceptions-title" description={t('description')} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('day')} hint={t('dayHint')}>
          <DatePicker
            value={day}
            max={accraToday()}
            onChange={(event) => {
              const next = event.target.value as DateString;
              setDay(next === '' ? accraToday() : next);
            }}
          />
        </Field>
        {day === accraToday() ? null : (
          <Button variant="secondary" size="sm" onClick={() => setDay(accraToday())}>
            {t('today')}
          </Button>
        )}
      </div>
      <QueryBoundary
        query={report}
        labels={labels}
        isEmpty={(r) => r.items.length === 0 && r.counts.length === 0}
      >
        {(r) => <ReportBody report={r} />}
      </QueryBoundary>
    </section>
  );
}

function ReportBody({ report }: { report: Report }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const auth = useAuth();
  const reviewing = exceptionReviewOn();
  const items = byUrgency(report.items, (item) => reviewOf(item) !== null);
  return (
    <div className="grid gap-6">
      {reviewing ? null : <Alert severity="info" title={t('review.waits')} />}
      {reviewing && !auth.can('rpt.exceptions.review') ? (
        <p className="text-sm text-fg-muted">{t('review.cannot')}</p>
      ) : null}
      <section aria-labelledby="exceptions-items" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="exceptions-items" className="text-lg font-semibold">
            {t('items.title')}
          </h2>
          <p className="text-sm text-fg-muted">{t('items.description')}</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('emptyBody')}</p>
        ) : (
          <ol aria-label={t('items.region')} className="grid gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <ExceptionCard item={item} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <Counts report={report} />
      <Patterns report={report} />
      <p className="text-control-sm text-fg-muted">
        {t('generated', { when: formatDateTime(report.generatedAt) })}
      </p>
    </div>
  );
}

function ExceptionCard({ item }: { item: Item }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const kindName = useKindName();
  const scope = useBranchScope();
  const review = reviewOf(item);
  const branch = scope.branches.find((b) => b.id === item.branchId);
  const titleId = `exception-${item.id}`;
  return (
    <Card aria-labelledby={titleId}>
      <CardBody className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={lookup(SEVERITY_TONE, item.severity, 'info')}
            variant={item.severity === 'URGENT' ? 'strong' : 'subtle'}
            icon={ShieldAlert}
            label={t(`severity.${item.severity}`, { defaultValue: item.severity })}
          />
          <h3 id={titleId} className="font-semibold">
            {kindName(item.kind)}
          </h3>
          {review === null ? (
            <StatusBadge tone="slate" label={t('review.notReviewed')} />
          ) : (
            <StatusBadge tone="good" icon={CircleCheck} label={t('review.reviewed')} />
          )}
        </div>
        <p>{item.summary}</p>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-0.5">
            <dt className="text-fg-muted">{t('item.branch')}</dt>
            <dd>{branch?.name ?? item.branchId}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-fg-muted">{t('item.who')}</dt>
            <dd>{item.actor?.displayName ?? t('item.noWho')}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-fg-muted">{t('item.when')}</dt>
            <dd>
              <When instant={item.raisedAt} />
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-fg-muted">{t('item.amount')}</dt>
            <dd>
              {item.amountPesewas === null ? (
                <span className="text-fg-muted">{t('item.noAmount')}</span>
              ) : (
                <MoneyDisplay pesewas={item.amountPesewas} />
              )}
            </dd>
          </div>
          <div className="grid gap-0.5 sm:col-span-2 lg:col-span-4">
            <dt className="text-fg-muted">{t('item.record')}</dt>
            <dd>
              <RecordLink document={item.subjectDocument} />
            </dd>
          </div>
        </dl>
        {item.abuseCases.length === 0 ? null : (
          <p className="text-control-sm text-fg-muted">
            {t('item.abuseCases', {
              count: item.abuseCases.length,
              cases: item.abuseCases.join(', '),
            })}
          </p>
        )}
        <ReviewPart item={item} review={review} />
      </CardBody>
    </Card>
  );
}

function RecordLink({ document }: { document: Item['subjectDocument'] }) {
  const { t } = useTranslation('exceptions');
  if (document === null) return <span className="text-fg-muted">{t('item.noRecord')}</span>;
  const doc = t(`docType.${document.docType}` as 'docType.SALES_ORDER', {
    defaultValue: t('unknownDoc'),
  });
  const path = recordPath(document.docType, document.id);
  if (path === null) {
    return (
      <span className="text-fg-muted">
        {document.number === null
          ? t('item.noScreenUnnumbered', { doc })
          : t('item.noScreen', { doc, number: document.number })}
      </span>
    );
  }
  return (
    <Link to={path} className="text-accent-text underline">
      {document.number === null
        ? t('item.openRecord', { doc })
        : t('item.openRecordNumbered', { doc, number: document.number })}
    </Link>
  );
}

/** The review: who and their note once reviewed; otherwise "Mark reviewed" for an Owner or a Manager. */
function ReviewPart({ item, review }: { item: Item; review: ExceptionReview | null }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const mutation = useReviewException();
  const keyFor = useIntentKey();
  const failureLabels = useStateLabels({
    loading: t('review.saving'),
    emptyTitle: t('review.failed'),
    errorTitle: t('review.failed'),
    deniedTitle: t('review.cannot'),
  });
  if (review !== null) {
    return (
      <div className="grid gap-1 rounded-md border border-border bg-surface-sunken p-3 text-sm">
        <p className="font-semibold">
          {t('review.by', {
            name: review.reviewedBy.displayName,
            when: formatDateTime(review.reviewedAt),
          })}
        </p>
        <p>
          <span className="text-fg-muted">{t('review.note')}: </span>
          {review.note}
        </p>
      </div>
    );
  }
  if (!exceptionReviewOn() || !auth.can('rpt.exceptions.review')) return null;
  return (
    <div className="grid gap-2">
      <div>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('review.markFor', { summary: item.summary })}
          onClick={() => {
            mutation.reset();
            setOpen(true);
          }}
        >
          <CircleCheck aria-hidden="true" />
          {t('review.mark')}
        </Button>
      </div>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('review.dialogTitle')}
        body={t('review.dialogBody', { summary: item.summary })}
        fieldLabel={t('review.noteLabel')}
        fieldHint=""
        submitLabel={t('review.save')}
        error={mutation.error}
        failureLabels={failureLabels}
        onConfirm={async (note) => {
          const body = { note };
          await mutation.mutateAsync(
            { path: { id: item.id }, body },
            { idempotencyKey: keyFor({ id: item.id, ...body }) },
          );
          setOpen(false);
        }}
      />
    </div>
  );
}

/** What each control raised: the API's count and amount per kind. */
function Counts({ report }: { report: Report }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const kindName = useKindName();
  if (report.counts.length === 0) return null;
  return (
    <section aria-labelledby="exceptions-counts" className="grid gap-3">
      <h2 id="exceptions-counts" className="text-lg font-semibold">
        {t('counts.title')}
      </h2>
      <TableContainer aria-label={t('counts.table')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('counts.kind')}</TableHead>
              <TableHead numeric>{t('counts.count')}</TableHead>
              <TableHead numeric>{t('counts.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.counts.map((count) => (
              <TableRow key={count.kind}>
                <TableRowHeader>{kindName(count.kind)}</TableRowHeader>
                <TableCell numeric label={t('counts.count')}>
                  {count.count}
                </TableCell>
                <TableCell numeric label={t('counts.amount')}>
                  <MoneyDisplay pesewas={count.amountPesewas} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}

/** Who did what how often: each group the API sends with rows, then who approved whom. */
function Patterns({ report }: { report: Report }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const groups = PATTERNS.filter((key) => report[key].length > 0);
  if (groups.length === 0 && report.approvalPairs.length === 0) return null;
  return (
    <section aria-labelledby="exceptions-patterns" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="exceptions-patterns" className="text-lg font-semibold">
          {t('patterns.title')}
        </h2>
        <p className="text-sm text-fg-muted">{t('patterns.description')}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((key) => (
          <RateTable key={key} title={t(`patterns.${key}`)} rows={report[key]} />
        ))}
        {report.approvalPairs.length === 0 ? null : (
          <div className="grid gap-2">
            <h3 className="font-semibold">{t('patterns.pairs')}</h3>
            <p className="text-sm text-fg-muted">{t('patterns.pairsDescription')}</p>
            <TableContainer aria-label={t('patterns.pairs')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('patterns.maker')}</TableHead>
                    <TableHead>{t('patterns.checker')}</TableHead>
                    <TableHead numeric>{t('patterns.count')}</TableHead>
                    <TableHead numeric>{t('patterns.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.approvalPairs.map((pair) => (
                    <TableRow key={`${pair.maker.id}-${pair.checker.id}`}>
                      <TableRowHeader>{pair.maker.displayName}</TableRowHeader>
                      <TableCell label={t('patterns.checker')}>
                        {pair.checker.displayName}
                      </TableCell>
                      <TableCell numeric label={t('patterns.count')}>
                        {pair.count}
                      </TableCell>
                      <TableCell numeric label={t('patterns.amount')}>
                        <MoneyDisplay pesewas={pair.amountPesewas} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function RateTable({ title, rows }: { title: string; rows: readonly RateByUser[] }) {
  const { t } = useTranslation(['exceptions', 'common']);
  const rate = (value: string | null) => (value === null ? t('patterns.noRate') : `${value}%`);
  return (
    <div className="grid gap-2">
      <h3 className="font-semibold">{title}</h3>
      <TableContainer aria-label={title}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('patterns.person')}</TableHead>
              <TableHead numeric>{t('patterns.count')}</TableHead>
              <TableHead numeric>{t('patterns.amount')}</TableHead>
              <TableHead numeric>{t('patterns.rate')}</TableHead>
              <TableHead numeric>{t('patterns.comparison')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.actor.id}>
                <TableRowHeader>{row.actor.displayName}</TableRowHeader>
                <TableCell numeric label={t('patterns.count')}>
                  {row.count}
                </TableCell>
                <TableCell numeric label={t('patterns.amount')}>
                  <MoneyDisplay pesewas={row.amountPesewas} />
                </TableCell>
                <TableCell numeric label={t('patterns.rate')}>
                  {rate(row.ratePercent)}
                </TableCell>
                <TableCell numeric label={t('patterns.comparison')}>
                  {rate(row.comparisonRatePercent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
