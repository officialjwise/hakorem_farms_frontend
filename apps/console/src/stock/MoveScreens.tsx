import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  MoneyDisplay,
  NOT_APPLICABLE,
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
  type FailureLike,
  type QueryLike,
  Alert,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import {
  AdjustmentStatusBadge,
  DirectionBadge,
  ReceiptStatusBadge,
  TransferStatusBadge,
} from './presentation';
import { ReceiveTransfer } from './ReceiveTransfer';
import { useUnits } from './units';

type S = components['schemas'];
interface Column<T> {
  head: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
}
interface Paged<T> {
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}

/** A list of stock documents: the four states, a table that stacks at 360 px, cursor pages. */
function DocList<T extends { id: string }>({
  area,
  newPath,
  canCreate,
  query,
  pages,
  name,
  columns,
}: {
  area: 'adjustments' | 'transfers' | 'receipts';
  newPath: string;
  canCreate: boolean;
  query: QueryLike<Paged<T>, FailureLike>;
  pages: ReturnType<typeof useCursorPages>;
  name: (row: T) => ReactNode;
  columns: Column<T>[];
}) {
  const { t } = useTranslation(['stock', 'common']);
  const labels = useStateLabels({
    loading: t(`${area}.loading`),
    emptyTitle: t(`${area}.empty`),
    emptyDescription: t(`${area}.emptyBody`),
    errorTitle: t(`${area}.error`),
    deniedTitle: t(`${area}.denied`),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t(`${area}.columns.document`)}</TableHead>
        {columns.map((c) => (
          <TableHead key={c.head} numeric={c.numeric ?? false}>
            {c.head}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby={`${area}-title`} className="grid gap-4">
      <PageHeader
        title={t(`${area}.title`)}
        titleId={`${area}-title`}
        description={<BranchScopeNote />}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to={newPath}>{t(`${area}.new`)}</Link>
            </Button>
          ) : undefined
        }
      />
      <QueryBoundary
        query={query}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t(`${area}.table`)}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={columns.length + 1} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t(`${area}.table`)}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableRowHeader>{name(row)}</TableRowHeader>
                      {columns.map((c) => (
                        <TableCell key={c.head} numeric={c.numeric ?? false} label={c.head}>
                          {c.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t(`${area}.pages`)}
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
    </section>
  );
}

const cursorQuery = (cursor: string | undefined) => (cursor === undefined ? {} : { cursor });

export function AdjustmentsScreen() {
  const { t } = useTranslation('stock');
  const auth = useAuth();
  const pages = useCursorPages();
  const list = useApiQuery('listStockAdjustments', { query: cursorQuery(pages.cursor) });
  return (
    <DocList
      area="adjustments"
      newPath="/stock-adjustments/new"
      canCreate={auth.can('inv.adjustment.create')}
      query={list}
      pages={pages}
      name={(a: S['StockAdjustment']) => (
        <Link to={`/stock-adjustments/${a.id}`} className="text-accent-text underline">
          {a.adjustmentNo ?? t('move.unnumbered', { location: a.location.name })}
        </Link>
      )}
      columns={[
        {
          head: t('adjustments.columns.status'),
          cell: (a) => <AdjustmentStatusBadge status={a.status} />,
        },
        { head: t('adjustments.columns.location'), cell: (a) => a.location.name },
        { head: t('adjustments.columns.reason'), cell: (a) => a.reasonCode },
        {
          head: t('adjustments.columns.value'),
          numeric: true,
          cell: (a) => <MoneyDisplay pesewas={a.totalValuePesewas} />,
        },
      ]}
    />
  );
}

export function TransfersScreen() {
  const { t } = useTranslation('stock');
  const auth = useAuth();
  const pages = useCursorPages();
  const list = useApiQuery('listStockTransfers', { query: cursorQuery(pages.cursor) });
  return (
    <DocList
      area="transfers"
      newPath="/stock-transfers/new"
      canCreate={auth.can('inv.transfer.create')}
      query={list}
      pages={pages}
      name={(x: S['StockTransfer']) => (
        <Link to={`/stock-transfers/${x.id}`} className="text-accent-text underline">
          {x.transferNo ?? t('move.unnumbered', { location: x.from.name })}
        </Link>
      )}
      columns={[
        {
          head: t('transfers.columns.status'),
          cell: (x) => <TransferStatusBadge status={x.status} />,
        },
        {
          head: t('transfers.columns.route'),
          cell: (x) => t('transfers.route', { from: x.from.name, to: x.to.name }),
        },
        { head: t('transfers.columns.lines'), numeric: true, cell: (x) => x.lines.length },
      ]}
    />
  );
}

export function ReceiptsScreen() {
  const { t } = useTranslation('stock');
  const auth = useAuth();
  const pages = useCursorPages();
  const list = useApiQuery('listGoodsReceipts', { query: cursorQuery(pages.cursor) });
  return (
    <DocList
      area="receipts"
      newPath="/goods-receipts/new"
      canCreate={auth.can('inv.goods_receipt.create')}
      query={list}
      pages={pages}
      name={(r: S['GoodsReceipt']) => (
        <Link to={`/goods-receipts/${r.id}`} className="text-accent-text underline">
          {r.receiptNo ?? t('move.unnumbered', { location: r.location.name })}
        </Link>
      )}
      columns={[
        {
          head: t('receipts.columns.status'),
          cell: (r) => <ReceiptStatusBadge status={r.status} />,
        },
        { head: t('receipts.columns.kind'), cell: (r) => t(`receiptKind.${r.kind}`) },
        { head: t('receipts.columns.from'), cell: (r) => r.supplier?.name ?? NOT_APPLICABLE },
        { head: t('receipts.columns.received'), cell: (r) => <When instant={r.receivedAt} /> },
        {
          head: t('receipts.columns.value'),
          numeric: true,
          cell: (r) => <MoneyDisplay pesewas={r.totalValuePesewas} />,
        },
      ]}
    />
  );
}

/** One stock document: its facts, its lines, and the one write that moves stock, confirmed first. */
function DocDetail<T>({
  area,
  backTo,
  query,
  render,
}: {
  area: 'adjustments' | 'transfers' | 'receipts';
  backTo: string;
  query: QueryLike<T, FailureLike> & { error: (FailureLike & { status?: number }) | null };
  render: (record: T) => ReactNode;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const labels = useStateLabels({
    loading: t(`${area}.loadingOne`),
    emptyTitle: t(`${area}.notFound`),
    errorTitle: t(`${area}.errorOne`),
    deniedTitle: t(`${area}.denied`),
  });
  const back = (
    <Link to={backTo} className="text-accent-text underline">
      {t(`${area}.back`)}
    </Link>
  );
  if (query.error?.status === 404) {
    return (
      <EmptyState
        title={t(`${area}.notFound`)}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={query}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(record) => (
        <article aria-labelledby="doc-title" className="grid gap-4">
          {back}
          {render(record)}
        </article>
      )}
    </QueryBoundary>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <Card>
      <CardBody>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
          {items.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-fg-muted">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function LinesTable<L extends { id: string }>({
  label,
  lines,
  columns,
  name,
}: {
  label: string;
  lines: L[];
  columns: Column<L>[];
  name: (line: L) => ReactNode;
}) {
  const { t } = useTranslation('stock');
  return (
    <TableContainer aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('lines.product', { number: '' }).trim()}</TableHead>
            {columns.map((c) => (
              <TableHead key={c.head} numeric={c.numeric ?? false}>
                {c.head}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableRowHeader>{name(line)}</TableRowHeader>
              {columns.map((c) => (
                <TableCell key={c.head} numeric={c.numeric ?? false} label={c.head}>
                  {c.cell(line)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const productName = (line: { product: S['ProductRef']; stockUnit: S['StockUnitRef'] | null }) => (
  <span className="grid">
    <span>{line.product.name}</span>
    {line.stockUnit === null ? null : (
      <code className="text-control-sm">{line.stockUnit.identifier}</code>
    )}
  </span>
);

/** The confirm-then-write step for a draft, with the outcome kept on screen in words. */
function DraftAction({
  label,
  title,
  body,
  pendingLabel,
  failedTitle,
  done,
  awaiting,
  summary,
  run,
  error,
  pending,
}: {
  label: string;
  title: string;
  body: string;
  pendingLabel: string;
  failedTitle: string;
  done: string;
  awaiting: string;
  summary: ReactNode;
  run: () => Promise<unknown>;
  error: FailureLike | null;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  if (outcome !== null) {
    return <Alert severity={'good'} title={outcome} />;
  }
  return (
    <div>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        body={body}
        confirmLabel={label}
        pendingLabel={pendingLabel}
        pending={pending}
        error={error}
        failedTitle={failedTitle}
        onConfirm={() => {
          run()
            .then((answer) => {
              setOpen(false);
              setOutcome(isApprovalPending(answer) ? awaiting : done);
            })
            .catch(() => undefined);
        }}
      >
        {summary}
      </ConfirmDialog>
    </div>
  );
}

export function AdjustmentScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const units = useUnits();
  const adjustment = useApiQuery('getStockAdjustment', { path: { id } });
  const submit = useApiMutation('submitStockAdjustment', { invalidates: ['listStockOnHand'] });
  const keyFor = useIntentKey();
  return (
    <DocDetail
      area="adjustments"
      backTo="/stock-adjustments"
      query={adjustment}
      render={(a: S['StockAdjustment']) => {
        const qty = (line: S['StockAdjustmentLine']) => (
          <QuantityDisplay
            quantity={line.qty}
            unit={units.name(line.uom)}
            places={units.places(line.uom)}
          />
        );
        const summary = (
          <ul className="grid list-disc gap-1 ps-5">
            {a.lines.map((line) => (
              <li key={line.id}>
                {t(`direction.${line.direction}`)}: {line.product.name}, {qty(line)}
              </li>
            ))}
            <li>
              {t('adjustments.reason')}: {a.reasonCode}
            </li>
          </ul>
        );
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader
                title={a.adjustmentNo ?? t('move.unnumbered', { location: a.location.name })}
                titleId="doc-title"
              />
              <AdjustmentStatusBadge status={a.status} />
            </div>
            <Facts
              items={[
                [t('adjustments.location'), a.location.name],
                [t('adjustments.reason'), a.reasonCode],
                [t('adjustments.note'), a.note ?? NOT_APPLICABLE],
                [t('adjustments.value'), <MoneyDisplay key="v" pesewas={a.totalValuePesewas} />],
                [
                  t('move.createdBy'),
                  <span key="c">
                    {a.createdBy.displayName} · <When instant={a.createdAt} />
                  </span>,
                ],
              ]}
            />
            {a.status === 'PENDING_APPROVAL' ? (
              <p role="status">{t('adjustments.awaiting')}</p>
            ) : null}
            <LinesTable
              label={t('lines.title')}
              lines={a.lines}
              name={productName}
              columns={[
                {
                  head: t('lines.directionHead'),
                  cell: (l) => <DirectionBadge direction={l.direction} />,
                },
                { head: t('lines.qtyHead'), numeric: true, cell: qty },
                {
                  head: t('lines.valueHead'),
                  numeric: true,
                  cell: (l) => (
                    <MoneyDisplay
                      pesewas={l.valuePesewas}
                      notApplicableLabel={t('lines.valuedAtPosting')}
                    />
                  ),
                },
              ]}
            />
            {a.status === 'DRAFT' && auth.can('inv.adjustment.create') ? (
              <DraftAction
                label={t('adjustments.submit')}
                title={t('adjustments.submitTitle')}
                body={t('adjustments.submitBody')}
                pendingLabel={t('move.sending')}
                failedTitle={t('adjustments.notSubmitted')}
                done={t('adjustments.posted')}
                awaiting={t('adjustments.awaiting')}
                summary={summary}
                error={submit.error}
                pending={submit.isPending}
                run={() =>
                  submit.mutateAsync(
                    { path: { id: a.id } },
                    { idempotencyKey: keyFor({ submit: a.id }) },
                  )
                }
              />
            ) : null}
          </>
        );
      }}
    />
  );
}

export function TransferScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const units = useUnits();
  const transfer = useApiQuery('getStockTransfer', { path: { id } });
  const dispatch = useApiMutation('dispatchStockTransfer', { invalidates: ['listStockOnHand'] });
  const keyFor = useIntentKey();
  return (
    <DocDetail
      area="transfers"
      backTo="/stock-transfers"
      query={transfer}
      render={(x: S['StockTransfer']) => {
        const qty = (value: string | null, uom: string) =>
          value === null ? (
            NOT_APPLICABLE
          ) : (
            <QuantityDisplay quantity={value} unit={units.name(uom)} places={units.places(uom)} />
          );
        const summary = (
          <ul className="grid list-disc gap-1 ps-5">
            <li>{t('transfers.route', { from: x.from.name, to: x.to.name })}</li>
            {x.lines.map((line) => (
              <li key={line.id}>
                {line.product.name}, {qty(line.qtyDispatched, line.uom)}
              </li>
            ))}
          </ul>
        );
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader
                title={x.transferNo ?? t('move.unnumbered', { location: x.from.name })}
                titleId="doc-title"
              />
              <TransferStatusBadge status={x.status} />
            </div>
            <Facts
              items={[
                [t('transfers.from'), x.from.name],
                [t('transfers.to'), `${x.to.name} · ${x.toBranch.name}`],
                [
                  t('transfers.dispatched'),
                  <When key="d" instant={x.dispatchedAt} empty={t('transfers.notYet')} />,
                ],
                [
                  t('transfers.received'),
                  <When key="r" instant={x.receivedAt} empty={t('transfers.notYet')} />,
                ],
              ]}
            />
            {x.status === 'DISPATCHED' ? <p>{t('transfers.inTransit')}</p> : null}
            <LinesTable
              label={t('lines.title')}
              lines={x.lines}
              name={productName}
              columns={[
                {
                  head: t('transfers.columns.sent'),
                  numeric: true,
                  cell: (l) => qty(l.qtyDispatched, l.uom),
                },
                {
                  head: t('transfers.columns.arrived'),
                  numeric: true,
                  cell: (l) => qty(l.qtyReceived, l.uom),
                },
                {
                  head: t('transfers.columns.variance'),
                  numeric: true,
                  cell: (l) => qty(l.varianceQty, l.uom),
                },
                {
                  head: t('transfers.columns.reason'),
                  cell: (l) => l.varianceReasonCode ?? NOT_APPLICABLE,
                },
              ]}
            />
            {x.status === 'DRAFT' && auth.can('inv.transfer.dispatch') ? (
              <DraftAction
                label={t('transfers.dispatch')}
                title={t('transfers.dispatchTitle')}
                body={t('transfers.dispatchBody')}
                pendingLabel={t('move.sending')}
                failedTitle={t('transfers.notDispatched')}
                done={t('transfers.dispatchedDone')}
                awaiting={t('transfers.awaiting')}
                summary={summary}
                error={dispatch.error}
                pending={dispatch.isPending}
                run={() =>
                  dispatch.mutateAsync(
                    { path: { id: x.id } },
                    { idempotencyKey: keyFor({ dispatch: x.id }) },
                  )
                }
              />
            ) : null}
            {x.status === 'DISPATCHED' && auth.can('inv.transfer.receive') ? (
              <ReceiveTransfer transfer={x} />
            ) : null}
          </>
        );
      }}
    />
  );
}

export function ReceiptScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const units = useUnits();
  const receipt = useApiQuery('getGoodsReceipt', { path: { id } });
  const post = useApiMutation('postGoodsReceipt', { invalidates: ['listStockOnHand'] });
  const keyFor = useIntentKey();
  return (
    <DocDetail
      area="receipts"
      backTo="/goods-receipts"
      query={receipt}
      render={(r: S['GoodsReceipt']) => {
        const qty = (value: string, uom: string) => (
          <QuantityDisplay quantity={value} unit={units.name(uom)} places={units.places(uom)} />
        );
        const summary = (
          <ul className="grid list-disc gap-1 ps-5">
            {r.lines.map((line) => (
              <li key={line.id}>
                {line.product.name}, {qty(line.qtyReceived, line.uom)}, {t('lines.atCost')}{' '}
                <MoneyDisplay pesewas={line.valuePesewas} />
              </li>
            ))}
            <li>
              {t('receipts.total')}: <MoneyDisplay pesewas={r.totalValuePesewas} strong />
            </li>
          </ul>
        );
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader
                title={r.receiptNo ?? t('move.unnumbered', { location: r.location.name })}
                titleId="doc-title"
              />
              <ReceiptStatusBadge status={r.status} />
            </div>
            <Facts
              items={[
                [t('receipts.kind'), t(`receiptKind.${r.kind}`)],
                [t('receipts.location'), r.location.name],
                [t('receipts.columns.from'), r.supplier?.name ?? NOT_APPLICABLE],
                [t('receipts.deliveryNote'), r.deliveryNoteRef ?? NOT_APPLICABLE],
                [t('receipts.columns.received'), <When key="r" instant={r.receivedAt} />],
                [
                  t('receipts.total'),
                  <MoneyDisplay key="t" pesewas={r.totalValuePesewas} strong />,
                ],
              ]}
            />
            <LinesTable
              label={t('lines.title')}
              lines={r.lines}
              name={productName}
              columns={[
                {
                  head: t('receipts.columns.accepted'),
                  numeric: true,
                  cell: (l) => qty(l.qtyReceived, l.uom),
                },
                {
                  head: t('receipts.columns.rejected'),
                  numeric: true,
                  cell: (l) => qty(l.qtyRejected, l.uom),
                },
                {
                  head: t('lines.valueHead'),
                  numeric: true,
                  cell: (l) => <MoneyDisplay pesewas={l.valuePesewas} />,
                },
              ]}
            />
            {r.status === 'DRAFT' && auth.can('inv.goods_receipt.post') ? (
              <DraftAction
                label={t('receipts.post')}
                title={t('receipts.postTitle')}
                body={t('receipts.postBody')}
                pendingLabel={t('move.sending')}
                failedTitle={t('receipts.notPosted')}
                done={t('receipts.posted')}
                awaiting={t('receipts.awaiting')}
                summary={summary}
                error={post.error}
                pending={post.isPending}
                run={() =>
                  post.mutateAsync(
                    { path: { id: r.id } },
                    { idempotencyKey: keyFor({ post: r.id }) },
                  )
                }
              />
            ) : null}
          </>
        );
      }}
    />
  );
}
