import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  MoneyDisplay,
  MutationFailure,
  NOT_APPLICABLE,
  QuantityDisplay,
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
  formatDateTime,
  formatMoney,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import {
  CREDIT_REFUSALS,
  creditControlOn,
  useOrderCreditCheck,
  useRequestCreditOverride,
  type OrderCreditCheck,
} from '../requested/creditControl';
import { useUnits } from '../stock/units';

type S = components['schemas'];
type Order = S['SalesOrder'];

/** Whether a refusal is one of credit control's (CR-046), or the contract's "not built yet" (A-224). */
function creditRefusal(code: string | undefined): boolean {
  return code !== undefined && (CREDIT_REFUSALS as readonly string[]).includes(code);
}

/**
 * An order made from a quote: its lines at the quote's prices, the API's estimate, the quote it came from
 * and its invoice. Confirming a credit order is where credit control happens: the server refuses an order
 * that would take the buyer past their limit or their terms, and this page says so in words, with the
 * amount over from the server's own credit check (CR-046). An override is asked for here with a reason,
 * and approved in the approvals inbox by an Owner or Manager who did not ask.
 */
export function OrderScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { id = '' } = useParams();
  const units = useUnits();
  const order = useApiQuery('getOrder', { path: { id } });
  const labels = useStateLabels({
    loading: t('order.loading'),
    emptyTitle: t('order.notFound'),
    errorTitle: t('order.error'),
    deniedTitle: t('order.denied'),
  });
  if (order.error?.status === 404) {
    return (
      <EmptyState
        title={t('order.notFound')}
        description={t('common:states.notFoundBody')}
        action={
          <Link to="/quotes" className="text-accent-text underline">
            {t('back.quotes')}
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
        <article aria-labelledby="order-title" className="grid gap-4">
          {o.source?.docType === 'QUOTE' ? (
            <Link to={`/quotes/${o.source.id}`} className="text-accent-text underline">
              {t('order.backToQuote', { quote: o.source.number ?? '' })}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader title={o.orderNo ?? t('quote.unnumberedOrder')} titleId="order-title" />
            <StatusBadge
              tone="info"
              label={t(`orderStatus.${o.status}`, { defaultValue: o.status })}
            />
          </div>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [t('fields.customer'), o.customer?.name ?? o.contactName ?? NOT_APPLICABLE],
                    [
                      t('fields.paymentTerms'),
                      t(`paymentTerms.${o.paymentTerms}`, { defaultValue: o.paymentTerms }),
                    ],
                    [
                      t('fields.fulfilment'),
                      t(`fulfilment.${o.fulfilmentMode}`, { defaultValue: o.fulfilmentMode }),
                    ],
                    [
                      t('fields.creditCheck'),
                      o.creditCheck === null
                        ? t('creditCheck.notYet')
                        : t(`creditCheck.${o.creditCheck}`, { defaultValue: o.creditCheck }),
                    ],
                    [
                      t('fields.invoice'),
                      o.billingDocument === null ? (
                        t('order.noInvoice')
                      ) : (
                        <Link
                          key="i"
                          to={`/billing-documents/${o.billingDocument.id}`}
                          className="text-accent-text underline"
                        >
                          {o.billingDocument.number ?? t('order.openInvoice')}
                        </Link>
                      ),
                    ],
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
          <TableContainer aria-label={t('order.lines')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.product')}</TableHead>
                  <TableHead numeric>{t('columns.qty')}</TableHead>
                  <TableHead numeric>{t('columns.agreedPrice')}</TableHead>
                  <TableHead numeric>{t('columns.lineEstimate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableRowHeader>
                      {line.product.name}
                      {line.priceSource === 'QUOTE' ? (
                        <span className="block text-control-sm font-normal text-fg-muted">
                          {t('order.fromQuoteLine')}
                        </span>
                      ) : null}
                    </TableRowHeader>
                    <TableCell numeric label={t('columns.qty')}>
                      <QuantityDisplay
                        quantity={line.qtyOrdered}
                        unit={units.after(line.uom, line.qtyOrdered)}
                        places={units.places(line.uom)}
                      />
                    </TableCell>
                    <TableCell numeric label={t('columns.agreedPrice')}>
                      <MoneyDisplay pesewas={line.agreedUnitPricePesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.lineEstimate')}>
                      <MoneyDisplay pesewas={line.estimatedLineTotalPesewas} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Card>
            <CardBody>
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
                <dt className="font-semibold">{t('totals.estimate')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.estimatedTotalPesewas} strong />
                </dd>
                <dt>{t('totals.paid')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.paidPesewas} />
                </dd>
                <dt>{t('totals.outstanding')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.outstandingPesewas} />
                </dd>
              </dl>
            </CardBody>
          </Card>
          {o.paymentTerms === 'CREDIT' ? <CreditCheckCard order={o} /> : null}
          <OrderActions order={o} />
        </article>
      )}
    </QueryBoundary>
  );
}

/** The server's words for a check's outcome, with its figures, formatted and never worked out here. */
export function useCreditWords(): (check: OrderCreditCheck) => string {
  const { t } = useTranslation('wholesale');
  return (check) => {
    const values = {
      customer: check.customer.name,
      over: formatMoney(check.overLimitPesewas),
      limit: formatMoney(check.creditLimitPesewas),
      exposure: formatMoney(check.exposurePesewas),
      order: formatMoney(check.orderPesewas),
      overdue: formatMoney(check.overduePesewas),
      days: check.oldestOverdueDays ?? 0,
      terms: check.paymentTermsDays,
    };
    return t(`credit.outcome.${check.outcome}`, { ...values, defaultValue: check.outcome });
  };
}

/** The credit check of a credit order, from the server (CR-046), or words that it waits for the server. */
function CreditCheckCard({ order }: { order: Order }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const check = useOrderCreditCheck(order.id);
  const words = useCreditWords();
  const labels = useStateLabels({
    loading: t('credit.loading'),
    emptyTitle: t('credit.error'),
    errorTitle: t('credit.error'),
    deniedTitle: t('credit.denied'),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('credit.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {!creditControlOn() ? (
          <p>{t('credit.waits')}</p>
        ) : (
          <QueryBoundary
            query={check}
            labels={labels}
            isEmpty={() => false}
            loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
          >
            {(c) => (
              <div className="grid gap-3">
                <Alert
                  severity={
                    c.outcome === 'PASSES' || c.outcome === 'NOT_REQUIRED' ? 'good' : 'critical'
                  }
                  title={words(c)}
                />
                <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
                  <dt>{t('credit.limit')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={c.creditLimitPesewas} />
                  </dd>
                  <dt>{t('credit.exposure')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={c.exposurePesewas} />
                  </dd>
                  <dt>{t('credit.thisOrder')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={c.orderPesewas} />
                  </dd>
                  <dt className="font-semibold">{t('credit.overBy')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={c.overLimitPesewas} strong />
                  </dd>
                  <dt>{t('credit.overdue')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={c.overduePesewas} />
                  </dd>
                  <dt>{t('credit.oldest')}</dt>
                  <dd className="text-end">
                    {c.oldestOverdueDays === null
                      ? t('credit.nothingOverdue')
                      : t('credit.days', { count: c.oldestOverdueDays })}
                  </dd>
                  <dt>{t('credit.terms')}</dt>
                  <dd className="text-end">{t('credit.days', { count: c.paymentTermsDays })}</dd>
                </dl>
                <p className="text-control-sm text-fg-muted">
                  {t('credit.checkedAt', { when: formatDateTime(c.checkedAt) })}
                </p>
                {c.override === null ? null : <OverrideState override={c.override} />}
              </div>
            )}
          </QueryBoundary>
        )}
      </CardBody>
    </Card>
  );
}

function OverrideState({ override: o }: { override: NonNullable<OrderCreditCheck['override']> }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const asked = t('override.asked', {
    who: o.requestedBy.displayName,
    when: formatDateTime(o.requestedAt),
    reason: o.reason,
  });
  if (o.status === 'APPROVED' && o.decidedBy !== null) {
    return (
      <Alert
        severity="good"
        title={t('override.approved', {
          who: o.decidedBy.displayName,
          when: formatDateTime(o.decidedAt ?? o.requestedAt),
        })}
      >
        {asked}
      </Alert>
    );
  }
  if (o.status === 'PENDING_APPROVAL') {
    return (
      <Alert severity="warning" title={t('override.waiting', { who: o.requestedBy.displayName })}>
        <p>{asked}</p>
        <Link to={`/approvals/${o.approvalRequestId}`} className="text-accent-text underline">
          {t('outcome.openApproval')}
        </Link>
      </Alert>
    );
  }
  return (
    <Alert
      severity="critical"
      title={t(`override.${o.status}`, {
        who: o.decidedBy?.displayName ?? '',
        defaultValue: o.status,
      })}
    >
      {asked}
    </Alert>
  );
}

type Outcome =
  | { kind: 'confirmed' }
  | { kind: 'overrideWaiting'; approvalId: string }
  | { kind: 'proforma'; document: S['BillingDocument'] };

/** Confirm the order (the credit check), ask for an override, or issue its proforma invoice. */
function OrderActions({ order: o }: { order: Order }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const words = useCreditWords();
  const [open, setOpen] = useState<'confirm' | 'override' | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const confirm = useApiMutation('confirmOrder', { invalidates: ['getOrder', 'listOrders'] });
  const proforma = useApiMutation('issueProforma', { invalidates: ['getOrder'] });
  const override = useRequestCreditOverride();
  const check = useOrderCreditCheck(o.id, o.paymentTerms === 'CREDIT');
  const failure = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  const refused = confirm.error !== null && creditRefusal(confirm.error.code);
  const c = check.data;
  const blocked =
    c !== undefined &&
    (c.outcome === 'OVER_LIMIT' || c.outcome === 'PAST_TERMS' || c.outcome === 'ON_HOLD');
  const overrideOpen =
    c?.override === null ||
    c?.override === undefined ||
    ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(c.override.status);
  const canConfirm = o.status === 'PLACED' && auth.can('ord.order.confirm');
  const canOverride =
    creditControlOn() &&
    o.status === 'PLACED' &&
    blocked &&
    overrideOpen &&
    auth.can('ord.order.confirm');
  const canProforma =
    (o.status === 'PLACED' || o.status === 'CONFIRMED') && auth.can('bil.proforma.create');
  return (
    <div className="grid gap-3">
      {outcome?.kind === 'confirmed' ? (
        <Alert severity="good" title={t('order.confirmed', { order: o.orderNo ?? '' })} />
      ) : null}
      {outcome?.kind === 'overrideWaiting' ? (
        <Alert severity="warning" title={t('override.sent')}>
          <Link to={`/approvals/${outcome.approvalId}`} className="text-accent-text underline">
            {t('outcome.openApproval')}
          </Link>
        </Alert>
      ) : null}
      {outcome?.kind === 'proforma' ? (
        <Alert
          severity="good"
          title={t('order.proformaIssued', { number: outcome.document.documentNo ?? '' })}
        >
          <Link
            to={`/billing-documents/${outcome.document.id}`}
            className="text-accent-text underline"
          >
            {t('order.openProforma')}
          </Link>
        </Alert>
      ) : null}
      {/* A refused confirmation stays on the page, in words, with the server's figures. */}
      {refused && open === null ? (
        <Alert severity="critical" title={t('credit.refused')}>
          <p>{c === undefined ? confirm.error?.message : words(c)}</p>
          <p className="text-control-sm">{t('credit.refusedNext')}</p>
        </Alert>
      ) : null}
      {open === null && !refused ? (
        <MutationFailure error={shownFailure(confirm.error)} labels={failure} />
      ) : null}
      <MutationFailure error={shownFailure(proforma.error)} labels={failure} />
      <div className="flex flex-wrap gap-2">
        {canConfirm ? (
          <Button
            onClick={() => {
              confirm.reset();
              setOpen('confirm');
            }}
          >
            {t('order.confirm')}
          </Button>
        ) : null}
        {canOverride ? (
          <Button variant="secondary" onClick={() => setOpen('override')}>
            {t('override.ask')}
          </Button>
        ) : null}
        {canProforma ? (
          <Button
            variant="secondary"
            loading={proforma.isPending}
            loadingLabel={t('actions.working')}
            onClick={() => {
              const input = { path: { id: o.id } };
              proforma
                .mutateAsync(input, { idempotencyKey: keyFor({ proforma: o.id }) })
                .then((document) => setOutcome({ kind: 'proforma', document }))
                .catch(() => undefined);
            }}
          >
            {t('order.proforma')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={open === 'confirm'}
        onOpenChange={(next) => setOpen(next ? 'confirm' : null)}
        title={t('order.confirmTitle', { order: o.orderNo ?? '' })}
        body={o.paymentTerms === 'CREDIT' ? t('order.confirmCreditBody') : t('order.confirmBody')}
        confirmLabel={t('order.confirm')}
        pendingLabel={t('actions.working')}
        pending={confirm.isPending}
        error={refused ? null : shownFailure(confirm.error)}
        failedTitle={t('actions.failed')}
        onConfirm={() => {
          confirm
            .mutateAsync(
              { path: { id: o.id } },
              { idempotencyKey: keyFor({ confirm: o.id, version: o.version }) },
            )
            .then((answer) => {
              setOpen(null);
              setOutcome(
                isApprovalPending(answer)
                  ? { kind: 'overrideWaiting', approvalId: answer.approvalRequestId }
                  : { kind: 'confirmed' },
              );
            })
            .catch((error: unknown) => {
              // A credit refusal closes the dialog: its words stay on the page with the figures.
              if (creditRefusal((error as { code?: string }).code)) {
                setOpen(null);
                void check.refetch();
              }
            });
        }}
      >
        <p>
          {t('totals.estimate')}: <MoneyDisplay pesewas={o.estimatedTotalPesewas} strong />
        </p>
      </ConfirmDialog>
      {open === 'override' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('override.title', { order: o.orderNo ?? '' })}
          body={c === undefined ? t('override.body') : `${words(c)} ${t('override.body')}`}
          submitLabel={t('override.ask')}
          error={shownFailure(override.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: o.id }, body: { reason } };
            const answer = await override.mutateAsync(input, { idempotencyKey: keyFor(input) });
            confirm.reset();
            setOutcome({ kind: 'overrideWaiting', approvalId: answer.approvalRequestId });
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}
