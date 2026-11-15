import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  formatQuantity,
  MoneyDisplay,
  MutationFailure,
  NOT_APPLICABLE,
  NumberInput,
  Pagination,
  QuantityDisplay,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { DirectionBadge, StockTakeStatusBadge } from './presentation';
import { toQuantity, useUnits } from './units';

type StockTake = components['schemas']['StockTake'];
type Line = components['schemas']['StockTakeLine'];
/** Lines per page while counting: a phone screen's worth, saved page by page. */
const COUNT_PAGE = 25;

/**
 * FR-INV stock take, and the F5 gate: a storekeeper counts on a phone, standing in the cold room. The count
 * is blind (expected quantities are never shown while counting), saved page by page, then closed for
 * review, where the API's variances and their values at cost are shown, recounts entered, and the result
 * submitted. Above the threshold a second person approves (202), and nothing posts until then.
 */
export function StockTakeScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const { id = '' } = useParams();
  const take = useApiQuery('getStockTake', { path: { id } });
  const labels = useStateLabels({
    loading: t('take.loading'),
    emptyTitle: t('take.notFound'),
    errorTitle: t('take.error'),
    deniedTitle: t('take.denied'),
  });
  const back = (
    <Link to="/stock-takes" className="text-accent-text underline">
      {t('takes.back')}
    </Link>
  );
  if (take.error?.status === 404) {
    return (
      <EmptyState
        title={t('take.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={take}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <TakeDetail take={current} back={back} />}
    </QueryBoundary>
  );
}

function TakeDetail({ take, back }: { take: StockTake; back: React.ReactNode }) {
  const { t } = useTranslation(['stock', 'common']);
  const auth = useAuth();
  const title = take.stockTakeNo ?? t('take.unnumbered');
  return (
    <article aria-labelledby="take-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="take-title" className="text-2xl font-semibold">
            {t('take.title', { number: title, location: take.location.name })}
          </h1>
          <StockTakeStatusBadge status={take.status} />
        </div>
        <p className="text-fg-muted">
          {t(`scope.${take.scope}`)} ·{' '}
          {t('take.progress', { counted: take.countedLineCount, total: take.lineCount })}
          {take.snapshotAt === null ? null : (
            <>
              {' '}
              · {t('take.snapshot')} <When instant={take.snapshotAt} />
            </>
          )}
        </p>
      </div>
      {take.status === 'DRAFT' && auth.can('inv.stock_take.create') ? (
        <StartTake take={take} />
      ) : null}
      {take.status === 'COUNTING' ? (
        auth.can('inv.stock_take.count') ? (
          <CountLines take={take} />
        ) : (
          <p>{t('take.countingByOthers')}</p>
        )
      ) : null}
      {take.status === 'PENDING_APPROVAL' ? (
        <p role="status" className="font-semibold">
          {t('take.awaiting')}
        </p>
      ) : null}
      {take.status === 'REVIEW' ||
      take.status === 'PENDING_APPROVAL' ||
      take.status === 'POSTED' ||
      take.status === 'CANCELLED' ? (
        <ReviewLines take={take} />
      ) : null}
    </article>
  );
}

function StartTake({ take }: { take: StockTake }) {
  const { t } = useTranslation(['stock', 'common']);
  const [open, setOpen] = useState(false);
  const start = useApiMutation('startStockTake');
  const keyFor = useIntentKey();
  const input = { path: { id: take.id } };
  return (
    <Card>
      <CardBody className="grid gap-3">
        <p>{t('take.startHint')}</p>
        <div>
          <Button
            onClick={() => {
              start.reset();
              setOpen(true);
            }}
          >
            {t('take.start')}
          </Button>
        </div>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={t('take.startTitle', { location: take.location.name })}
          body={t('take.startBody')}
          confirmLabel={t('take.start')}
          pendingLabel={t('take.starting')}
          pending={start.isPending}
          error={start.error}
          failedTitle={t('take.notStarted')}
          onConfirm={() => {
            start
              .mutateAsync(input, { idempotencyKey: keyFor({ start: take.id }) })
              .then(() => setOpen(false))
              .catch(() => undefined);
          }}
        />
      </CardBody>
    </Card>
  );
}

/** One line's label: the product, the animal's tag for a serialised unit, and the unit counted in. */
function lineLabel(line: Line, unit: string): string {
  return [line.product.name, line.stockUnit?.identifier, unit].filter(Boolean).join(', ');
}

function CountLines({ take }: { take: StockTake }) {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const pages = useCursorPages();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const lines = useApiQuery('listStockTakeLines', {
    path: { id: take.id },
    query: { limit: COUNT_PAGE, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) },
  });
  const record = useApiMutation('recordStockTakeCounts');
  const close = useApiMutation('closeStockTakeCounting');
  const keyFor = useIntentKey();
  const dirty = Object.values(typed).some((value) => value !== '');
  const guard = useLeaveGuard(dirty);
  const labels = useStateLabels({
    loading: t('count.loading'),
    emptyTitle: t('count.empty'),
    emptyDescription: t('count.emptyBody'),
    errorTitle: t('count.error'),
    deniedTitle: t('count.denied'),
  });
  const failure = useStateLabels({
    loading: t('count.saving'),
    emptyTitle: t('count.notSaved'),
    errorTitle: t('count.notSaved'),
    deniedTitle: t('count.denied'),
  });

  const save = async () => {
    setNotice(null);
    const entries = Object.entries(typed).filter(([, value]) => value !== '');
    const bad = entries.filter(([, value]) => toQuantity(value) === null).map(([lineId]) => lineId);
    setInvalid(bad);
    if (bad.length > 0 || entries.length === 0) return;
    const body = {
      counts: entries.map(([lineId, value]) => ({ lineId, countedQty: toQuantity(value) ?? '' })),
    };
    await record.mutateAsync({ path: { id: take.id }, body }, { idempotencyKey: keyFor(body) });
    setTyped({});
    setNotice(t('count.saved', { count: entries.length }));
  };

  return (
    <section aria-labelledby="count-title" className="grid gap-3">
      <h2 id="count-title" className="text-xl font-semibold">
        {t('count.title')}
      </h2>
      <p>{t('count.blind')}</p>
      {notice !== null ? (
        <p role="status" className="font-semibold">
          {notice}
        </p>
      ) : null}
      <MutationFailure error={record.error} labels={failure} />
      <QueryBoundary
        query={lines}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
      >
        {(page) => (
          <form
            aria-label={t('count.form')}
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save().catch(() => undefined);
            }}
          >
            <ul className="grid gap-2">
              {page.data.map((line) => {
                const unit = units.name(line.uom);
                const places = units.places(line.uom);
                return (
                  <li key={line.id} className="rounded-md border border-border p-3">
                    <Field
                      label={lineLabel(line, unit)}
                      hint={
                        line.countedQty === null
                          ? t('count.notCounted')
                          : t('count.countedSoFar', {
                              qty: formatQuantity(line.countedQty, { places }),
                              unit,
                            })
                      }
                      error={
                        invalid.includes(line.id)
                          ? t('count.invalid', { count: places })
                          : undefined
                      }
                    >
                      <NumberInput
                        size="lg"
                        decimals={places}
                        value={typed[line.id] ?? ''}
                        onValueChange={(value) => setTyped((now) => ({ ...now, [line.id]: value }))}
                      />
                    </Field>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="lg"
                loading={record.isPending}
                loadingLabel={t('count.saving')}
              >
                {t('count.save')}
              </Button>
            </div>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('count.pages')}
                hasPrevious={pages.hasPrevious && !dirty}
                hasNext={page.page.hasMore && page.page.nextCursor !== null && !dirty}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
            {dirty ? (
              <p className="text-control-sm text-fg-muted">{t('count.saveBeforePaging')}</p>
            ) : null}
          </form>
        )}
      </QueryBoundary>
      <div>
        <Button
          variant="secondary"
          size="lg"
          disabled={dirty}
          onClick={() => {
            close.reset();
            setClosing(true);
          }}
        >
          {t('count.finish')}
        </Button>
      </div>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={t('count.finishTitle')}
        body={t('count.finishBody', { counted: take.countedLineCount, total: take.lineCount })}
        confirmLabel={t('count.finish')}
        pendingLabel={t('count.finishing')}
        pending={close.isPending}
        error={close.error}
        failedTitle={t('count.notFinished')}
        onConfirm={() => {
          close
            .mutateAsync({ path: { id: take.id } }, { idempotencyKey: keyFor({ close: take.id }) })
            .then(() => setClosing(false))
            .catch(() => undefined);
        }}
      />
      <LeaveGuardDialog guard={guard} />
    </section>
  );
}

function ReviewLines({ take }: { take: StockTake }) {
  const { t } = useTranslation(['stock', 'common']);
  const auth = useAuth();
  const units = useUnits();
  const pages = useCursorPages();
  const [recounts, setRecounts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<'pending' | 'posted' | null>(null);
  const lines = useApiQuery('listStockTakeLines', {
    path: { id: take.id },
    query: { limit: 50, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) },
  });
  const record = useApiMutation('recordStockTakeCounts');
  const submit = useApiMutation('submitStockTake', { invalidates: ['listStockOnHand'] });
  const keyFor = useIntentKey();
  const inReview = take.status === 'REVIEW';
  const canRecount = inReview && auth.can('inv.stock_take.count');
  const labels = useStateLabels({
    loading: t('review.loading'),
    emptyTitle: t('count.empty'),
    emptyDescription: t('count.emptyBody'),
    errorTitle: t('review.error'),
    deniedTitle: t('count.denied'),
  });
  const quantity = (value: string | null, uom: string) =>
    value === null ? (
      NOT_APPLICABLE
    ) : (
      <QuantityDisplay quantity={value} unit={units.name(uom)} places={units.places(uom)} />
    );
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('review.columns.line')}</TableHead>
        <TableHead numeric>{t('review.columns.expected')}</TableHead>
        <TableHead numeric>{t('review.columns.counted')}</TableHead>
        <TableHead>{t('review.columns.variance')}</TableHead>
        <TableHead numeric>{t('review.columns.value')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="review-title" className="grid gap-3">
      <h2 id="review-title" className="text-xl font-semibold">
        {t('review.title')}
      </h2>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="text-fg-muted">{t('review.gain')}</dt>
        <dd>
          <MoneyDisplay
            pesewas={take.gainValuePesewas}
            notApplicableLabel={t('review.notValued')}
          />
        </dd>
        <dt className="text-fg-muted">{t('review.loss')}</dt>
        <dd>
          <MoneyDisplay
            pesewas={take.lossValuePesewas}
            negative
            notApplicableLabel={t('review.notValued')}
          />
        </dd>
      </dl>
      {notice !== null ? (
        <p role="status" className="font-semibold">
          {notice}
        </p>
      ) : null}
      {outcome !== null ? (
        <p role="status" className="font-semibold">
          {outcome === 'pending' ? t('review.pending') : t('review.posted')}
        </p>
      ) : null}
      <QueryBoundary
        query={lines}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('review.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={5} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('review.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((line) => (
                    <TableRow key={line.id}>
                      <TableRowHeader>
                        <span className="grid">
                          <span>{line.product.name}</span>
                          {line.stockUnit === null ? null : (
                            <code className="text-control-sm">{line.stockUnit.identifier}</code>
                          )}
                          {line.needsRecount ? (
                            <span className="text-control-sm font-semibold">
                              {t('review.recountNeeded')}
                            </span>
                          ) : null}
                        </span>
                      </TableRowHeader>
                      <TableCell numeric label={t('review.columns.expected')}>
                        {quantity(line.expectedQty, line.uom)}
                      </TableCell>
                      <TableCell numeric label={t('review.columns.counted')}>
                        {quantity(line.recountQty ?? line.countedQty, line.uom)}
                        {canRecount && line.needsRecount ? (
                          <Field label={t('review.recountFor', { name: line.product.name })}>
                            <NumberInput
                              decimals={units.places(line.uom)}
                              value={recounts[line.id] ?? ''}
                              onValueChange={(value) =>
                                setRecounts((now) => ({ ...now, [line.id]: value }))
                              }
                            />
                          </Field>
                        ) : null}
                      </TableCell>
                      <TableCell label={t('review.columns.variance')}>
                        {line.varianceDirection === null ? (
                          NOT_APPLICABLE
                        ) : (
                          <span className="grid gap-1">
                            <DirectionBadge direction={line.varianceDirection} />
                            {line.varianceQty === null
                              ? null
                              : quantity(line.varianceQty, line.uom)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell numeric label={t('review.columns.value')}>
                        <MoneyDisplay
                          pesewas={line.varianceValuePesewas}
                          negative={line.varianceDirection === 'LOSS'}
                          notApplicableLabel={t('review.notValued')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('review.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
      {canRecount && Object.values(recounts).some((v) => v !== '') ? (
        <div className="grid gap-2">
          <MutationFailure error={record.error} labels={labels} />
          <div>
            <Button
              loading={record.isPending}
              loadingLabel={t('count.saving')}
              onClick={() => {
                const entries = Object.entries(recounts).filter(([, v]) => toQuantity(v) !== null);
                const body = {
                  counts: entries.map(([lineId, v]) => ({
                    lineId,
                    countedQty: toQuantity(v) ?? '',
                    isRecount: true,
                  })),
                };
                record
                  .mutateAsync({ path: { id: take.id }, body }, { idempotencyKey: keyFor(body) })
                  .then(() => {
                    setRecounts({});
                    setNotice(t('review.recountsSaved', { count: entries.length }));
                  })
                  .catch(() => undefined);
              }}
            >
              {t('review.saveRecounts')}
            </Button>
          </div>
        </div>
      ) : null}
      {inReview && outcome === null && auth.can('inv.stock_take.post') ? (
        <div>
          <Button
            onClick={() => {
              submit.reset();
              setSubmitting(true);
            }}
          >
            {t('review.submit')}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={submitting}
        onOpenChange={setSubmitting}
        title={t('review.submitTitle')}
        body={t('review.submitBody')}
        confirmLabel={t('review.submit')}
        pendingLabel={t('review.submitting')}
        pending={submit.isPending}
        error={submit.error}
        failedTitle={t('review.notSubmitted')}
        onConfirm={() => {
          submit
            .mutateAsync({ path: { id: take.id } }, { idempotencyKey: keyFor({ submit: take.id }) })
            .then((answer) => {
              setSubmitting(false);
              setOutcome(isApprovalPending(answer) ? 'pending' : 'posted');
            })
            .catch(() => undefined);
        }}
      >
        <ul className="grid list-disc gap-1 ps-5">
          <li>
            {t('review.gain')}:{' '}
            <MoneyDisplay
              pesewas={take.gainValuePesewas}
              notApplicableLabel={t('review.notValued')}
            />
          </li>
          <li>
            {t('review.loss')}:{' '}
            <MoneyDisplay
              pesewas={take.lossValuePesewas}
              negative
              notApplicableLabel={t('review.notValued')}
            />
          </li>
          <li>{t('take.progress', { counted: take.countedLineCount, total: take.lineCount })}</li>
        </ul>
      </ConfirmDialog>
    </section>
  );
}
