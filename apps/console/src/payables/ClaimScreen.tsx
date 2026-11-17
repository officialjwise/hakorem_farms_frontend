import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DatePicker,
  EmptyState,
  Field,
  Input,
  MoneyDisplay,
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
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { useUnits } from '../stock/units';
import { today } from './instant';
import { ClaimStatusBadge, useInvoiceName } from './presentation';

type S = components['schemas'];
type Claim = S['SupplierClaim'];

/**
 * A claim with a supplier for goods turned away at the door (CR-036, 2.4.0): each rejected line with the
 * value the server put on it, and how it is settled. It is settled once, either by the supplier's approved
 * invoice that left the rejected goods out, or by a credit note drafted from it, which a different person
 * approves. Nothing here is valued or keyed by hand.
 */
export function SupplierClaimScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const { id = '' } = useParams();
  const units = useUnits();
  const claim = useApiQuery('getSupplierClaim', { path: { id } });
  // The reasons goods are turned away at the door (2.3.0): `reference`.
  const reasons = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'GOODS_RECEIPT_REJECTION', limit: 100 } },
    { staleClass: 'reference' },
  );
  const reasonName = (code: string) =>
    reasons.data?.items.find((r) => r.code === code)?.description ?? code;
  const labels = useStateLabels({
    loading: t('claim.loading'),
    emptyTitle: t('claim.notFound'),
    errorTitle: t('claim.error'),
    deniedTitle: t('claim.denied'),
  });
  if (claim.error?.status === 404) {
    return <EmptyState title={t('claim.notFound')} description={t('common:states.notFoundBody')} />;
  }
  return (
    <QueryBoundary
      query={claim}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(c) => (
        <article aria-labelledby="claim-title" className="grid gap-4">
          <Link to={`/suppliers/${c.supplier.id}`} className="text-accent-text underline">
            {t('back.account', { supplier: c.supplier.name })}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              title={t('claim.title', { receipt: c.goodsReceipt.number ?? '' })}
              titleId="claim-title"
            />
            <ClaimStatusBadge status={c.status} />
          </div>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [
                      t('fields.supplier'),
                      <span key="s">
                        {c.supplier.name} <ReadableId value={c.supplier.publicId} />
                      </span>,
                    ],
                    [
                      t('fields.order'),
                      <Link
                        key="o"
                        to={`/purchase-orders/${c.purchaseOrder.id}`}
                        className="text-accent-text underline"
                      >
                        {c.purchaseOrder.number ?? t('enter.unnumbered')}
                      </Link>,
                    ],
                    [
                      t('fields.receipt'),
                      <Link
                        key="r"
                        to={`/goods-receipts/${c.goodsReceipt.id}`}
                        className="text-accent-text underline"
                      >
                        {c.goodsReceipt.number ?? t('enter.unnumbered')}
                      </Link>,
                    ],
                    [t('claim.receivedBy'), c.receivedBy.displayName],
                    [t('claim.raisedBy'), c.createdBy.displayName],
                    [t('claim.raisedAt'), <When key="w" instant={c.createdAt} />],
                    ...(c.note === null
                      ? []
                      : ([[t('claim.note'), c.note]] satisfies [string, ReactNode][])),
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
          <TableContainer aria-label={t('claim.lines')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.product')}</TableHead>
                  <TableHead>{t('columns.reason')}</TableHead>
                  <TableHead numeric>{t('columns.rejected')}</TableHead>
                  <TableHead numeric>{t('columns.orderPrice')}</TableHead>
                  <TableHead numeric>{t('columns.claimed')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableRowHeader>{line.product.name}</TableRowHeader>
                    <TableCell label={t('columns.reason')}>
                      {reasonName(line.rejectionReasonCode)}
                    </TableCell>
                    <TableCell numeric label={t('columns.rejected')}>
                      <QuantityDisplay
                        quantity={line.qtyRejectedBase}
                        unit={units.name(line.baseUom)}
                        places={units.places(line.baseUom)}
                      />
                    </TableCell>
                    <TableCell numeric label={t('columns.orderPrice')}>
                      {t('enter.per', { unit: units.name(line.orderUom) })}{' '}
                      <MoneyDisplay pesewas={line.orderUnitPricePesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.claimed')}>
                      <MoneyDisplay pesewas={line.claimedValuePesewas} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 grid-cols-[minmax(0,1fr)_max-content]">
                <dt className="font-semibold">{t('claim.claimed')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={c.claimedPesewas} strong />
                </dd>
              </dl>
            </CardBody>
          </Card>
          <ClaimSettlement claim={c} />
        </article>
      )}
    </QueryBoundary>
  );
}

function ClaimSettlement({ claim: c }: { claim: Claim }) {
  const { t } = useTranslation(['payables', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const invoiceName = useInvoiceName();
  const keyFor = useIntentKey();
  const [open, setOpen] = useState<'settle' | 'credit' | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [creditNo, setCreditNo] = useState('');
  const [creditDate, setCreditDate] = useState(today());
  const [checked, setChecked] = useState(false);
  const [settled, setSettled] = useState<Claim | null>(null);
  const canSettle = auth.can('pur.supplier_invoice.match');
  const canCredit = auth.can('pur.supplier_invoice.create');
  const open_ = c.status === 'OPEN' && c.creditNote === null && settled === null;
  const invoices = useApiQuery(
    'listSupplierInvoices',
    { query: { supplierId: c.supplier.id, kind: 'INVOICE', limit: 100 } },
    { enabled: open_ && (canSettle || canCredit) },
  );
  const after = {
    invalidates: ['listSupplierClaims', 'getSupplierClaim', 'listGoodsReceiptClaims'],
  } as const;
  const settle = useApiMutation('settleSupplierClaim', after);
  const draft = useApiMutation('draftSupplierClaimCreditNote', {
    invalidates: [...after.invalidates, 'listSupplierInvoices'],
  });
  const required = t('common:field.required');
  // The approved invoices of the claim's own order: a filter on the API's rows, nothing worked out.
  const approved = (invoices.data?.data ?? []).filter(
    (i) =>
      (i.status === 'APPROVED' || i.status === 'PAID') &&
      i.purchaseOrder?.id === c.purchaseOrder.id,
  );
  const options = approved.map((i) => ({ value: i.id, label: invoiceName(i) }));
  const shown = settled ?? c;
  if (shown.status === 'SETTLED') {
    return (
      <Alert severity="good" title={t('claim.settled')}>
        <p>
          {shown.settledBy === null
            ? null
            : t('claim.settledBy', {
                name: invoiceName({
                  kind: shown.settledBy.kind,
                  supplierInvoiceNo: shown.settledBy.supplierInvoiceNo,
                }),
              })}{' '}
          <When instant={shown.settledAt} />
        </p>
        {shown.settledBy === null ? null : (
          <Link
            to={`/supplier-invoices/${shown.settledBy.id}`}
            className="text-accent-text underline"
          >
            {t('claim.openSettledBy')}
          </Link>
        )}
      </Alert>
    );
  }
  if (c.creditNote !== null) {
    return (
      <Alert
        severity="info"
        title={t('claim.creditDrafted', { number: c.creditNote.supplierInvoiceNo })}
      >
        <div className="grid gap-1">
          <p>{t('claim.creditDraftedBody')}</p>
          <Link to={`/supplier-invoices/${c.creditNote.id}`} className="text-accent-text underline">
            {t('claim.openCredit')}
          </Link>
        </div>
      </Alert>
    );
  }
  if (!canSettle && !canCredit) {
    return <p className="text-fg-muted">{t('claim.whoSettles')}</p>;
  }
  const choose = (
    <Field
      label={t('claim.invoice')}
      hint={t(open === 'settle' ? 'claim.invoiceSettleHint' : 'claim.invoiceCreditHint')}
      required
      requiredLabel={required}
      error={checked && invoiceId === '' ? required : undefined}
    >
      <Select
        value={invoiceId}
        onValueChange={setInvoiceId}
        placeholder={options.length === 0 ? t('claim.noInvoices') : t('claim.chooseInvoice')}
        options={options}
        disabled={options.length === 0}
      />
    </Field>
  );
  const summary = (
    <ul className="grid list-disc gap-1 ps-5">
      <li>{t('summary.supplier', { supplier: c.supplier.name })}</li>
      <li>
        {t('claim.claimed')}: <MoneyDisplay pesewas={c.claimedPesewas} strong />
      </li>
    </ul>
  );
  return (
    <section aria-labelledby="settle-title" className="grid gap-3">
      <h2 id="settle-title" className="text-lg font-semibold">
        {t('claim.settleTitle')}
      </h2>
      <p className="text-fg-muted">{t('claim.settleIntro', { supplier: c.supplier.name })}</p>
      <div className="flex flex-wrap gap-2">
        {canSettle ? (
          <Button
            onClick={() => {
              settle.reset();
              setChecked(false);
              setOpen('settle');
            }}
          >
            {t('claim.settle')}
          </Button>
        ) : null}
        {canCredit ? (
          <Button
            variant="secondary"
            onClick={() => {
              draft.reset();
              setChecked(false);
              setOpen('credit');
            }}
          >
            {t('claim.credit')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={open === 'settle'}
        onOpenChange={(next) => setOpen(next ? 'settle' : null)}
        title={t('claim.settleDialog')}
        body={t('claim.settleBody')}
        confirmLabel={t('claim.settle')}
        pendingLabel={t('actions.working')}
        pending={settle.isPending}
        error={shownFailure(settle.error)}
        failedTitle={t('claim.notSettled')}
        onConfirm={() => {
          setChecked(true);
          if (invoiceId === '') return;
          const input = { path: { id: c.id }, body: { supplierInvoiceId: invoiceId } };
          settle
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then((answer) => {
              setOpen(null);
              setSettled(answer);
            })
            .catch(() => undefined);
        }}
      >
        {choose}
        {summary}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'credit'}
        onOpenChange={(next) => setOpen(next ? 'credit' : null)}
        title={t('claim.creditDialog')}
        body={t('claim.creditBody')}
        confirmLabel={t('claim.credit')}
        pendingLabel={t('actions.working')}
        pending={draft.isPending}
        error={shownFailure(draft.error)}
        failedTitle={t('claim.notDrafted')}
        onConfirm={() => {
          setChecked(true);
          if (invoiceId === '' || creditNo.trim() === '' || creditDate === '') return;
          const input = {
            path: { id: c.id },
            body: {
              originalInvoiceId: invoiceId,
              supplierInvoiceNo: creditNo.trim(),
              invoiceDate: creditDate,
            },
          };
          draft
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then((note) => navigate(`/supplier-invoices/${note.id}`))
            .catch(() => undefined);
        }}
      >
        {choose}
        <Field
          label={t('claim.creditNo')}
          hint={t('claim.creditNoHint')}
          required
          requiredLabel={required}
          error={checked && creditNo.trim() === '' ? required : undefined}
        >
          <Input
            value={creditNo}
            onChange={(event) => setCreditNo(event.target.value)}
            maxLength={60}
          />
        </Field>
        <Field
          label={t('claim.creditDate')}
          required
          requiredLabel={required}
          error={checked && creditDate === '' ? required : undefined}
        >
          <DatePicker value={creditDate} onChange={(event) => setCreditDate(event.target.value)} />
        </Field>
        {summary}
      </ConfirmDialog>
    </section>
  );
}
