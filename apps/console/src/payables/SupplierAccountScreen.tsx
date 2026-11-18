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
  QueryBoundary,
  Skeleton,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { ReadableId } from '../lib/ReadableId';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import {
  ClaimStatusBadge,
  InvoiceStatusBadge,
  PaymentStatusBadge,
  useInvoiceName,
} from './presentation';

type S = components['schemas'];

/**
 * A supplier's account: the balance the server works out (`getSupplierBalance`, CR-042, 2.9.0), and beneath
 * it each invoice still owed, each open claim and each payment, with the API's own figures. It never adds the
 * rows up itself.
 */
export function SupplierAccountScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const supplier = useApiQuery('getSupplier', { path: { id } });
  const labels = useStateLabels({
    loading: t('account.loading'),
    emptyTitle: t('account.notFound'),
    errorTitle: t('account.error'),
    deniedTitle: t('account.denied'),
  });
  const back = (
    <Link to="/suppliers" className="text-accent-text underline">
      {t('back.suppliers')}
    </Link>
  );
  if (supplier.error?.status === 404) {
    return (
      <EmptyState
        title={t('account.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={supplier}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(s) => (
        <article aria-labelledby="account-title" className="grid gap-4">
          {back}
          <PageHeader
            title={t('account.title', { supplier: s.name })}
            titleId="account-title"
            description={<ReadableId value={s.publicId} />}
            actions={
              <div className="flex flex-wrap gap-2">
                {auth.can('pur.supplier_invoice.create') ? (
                  <Button asChild variant="secondary">
                    <Link to={`/supplier-invoices/new?supplier=${s.id}`}>{t('invoices.new')}</Link>
                  </Button>
                ) : null}
                {auth.can('pur.supplier_payment.create') ? (
                  <Button asChild>
                    <Link to={`/supplier-payments/new?supplier=${s.id}`}>{t('payments.new')}</Link>
                  </Button>
                ) : null}
              </div>
            }
          />
          <Balance supplierId={s.id} />
          <OwedInvoices supplierId={s.id} />
          <OpenClaims supplierId={s.id} />
          <Payments supplierId={s.id} />
        </article>
      )}
    </QueryBoundary>
  );
}

/** The server's balance (`getSupplierBalance`, 2.9.0). */
function Balance({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation(['payables', 'common']);
  const balance = useApiQuery('getSupplierBalance', { path: { id: supplierId } });
  const labels = useStateLabels({
    loading: t('balance.loading'),
    emptyTitle: t('balance.error'),
    errorTitle: t('balance.error'),
    deniedTitle: t('balance.denied'),
  });
  return (
    <section aria-labelledby="balance-title">
      <Card>
        <CardBody className="grid gap-3">
          <h2 id="balance-title" className="text-lg font-semibold">
            {t('balance.title')}
          </h2>
          <QueryBoundary
            query={balance}
            labels={labels}
            isEmpty={() => false}
            loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
          >
            {(b) => (
              <>
                <dl className="grid gap-x-4 gap-y-2 grid-cols-[minmax(0,1fr)_max-content]">
                  <dt className="font-semibold">{t('balance.owed')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={b.owedPesewas} strong />
                  </dd>
                  <dt>{t('balance.claimed')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={b.claimedPesewas} />
                  </dd>
                  <dt>{t('balance.paid')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={b.paidPesewas} />
                  </dd>
                  <dt>{t('balance.inPayment')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={b.inPaymentPesewas} />
                  </dd>
                  <dt>{t('balance.awaitingApproval')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={b.awaitingApprovalPesewas} />
                  </dd>
                </dl>
                <p className="text-control-sm text-fg-muted">
                  {t('balance.asOf')} <When instant={b.asOf} />
                </p>
              </>
            )}
          </QueryBoundary>
        </CardBody>
      </Card>
    </section>
  );
}

function OwedInvoices({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation(['payables', 'common']);
  const pages = useCursorPages();
  const invoiceName = useInvoiceName();
  const list = useApiQuery('listSupplierInvoices', {
    query: {
      supplierId,
      outstandingOnly: true,
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('account.invoicesLoading'),
    emptyTitle: t('account.invoicesEmpty'),
    errorTitle: t('invoices.error'),
    deniedTitle: t('invoices.denied'),
  });
  const view = useTableView<S['SupplierInvoice']>([
    {
      id: 'invoice',
      rowHeader: true,
      head: t('columns.invoice'),
      sortValue: (i) => i.supplierInvoiceNo,
      cell: (i) => (
        <Link to={`/supplier-invoices/${i.id}`} className="text-accent-text underline">
          {invoiceName(i)}
        </Link>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (i) => i.status,
      cell: (i) => <InvoiceStatusBadge status={i.status} />,
    },
    { id: 'due', head: t('columns.due'), sortValue: (i) => i.dueDate, cell: (i) => i.dueDate },
    {
      id: 'outstanding',
      head: t('columns.outstanding'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (i) => i.outstandingPesewas,
      cell: (i) => <MoneyDisplay pesewas={i.outstandingPesewas} />,
    },
  ]);
  return (
    <TableCard
      heading={<h2 className="text-lg font-semibold">{t('account.invoices')}</h2>}
      view={view}
      query={list}
      labels={labels}
      rows={(page) => page.data}
      rowKey={(row) => row.id}
      tableLabel={t('account.invoices')}
      exportName={t('account.invoices')}
      pages={{ state: pages, info: (page) => page.page, label: t('account.invoicesPages') }}
    />
  );
}

function OpenClaims({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation(['payables', 'common']);
  const pages = useCursorPages();
  const list = useApiQuery('listSupplierClaims', {
    query: {
      supplierId,
      status: 'OPEN',
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('account.claimsLoading'),
    emptyTitle: t('account.claimsEmpty'),
    errorTitle: t('claim.error'),
    deniedTitle: t('claim.denied'),
  });
  const view = useTableView<S['SupplierClaim']>([
    {
      id: 'claim',
      rowHeader: true,
      head: t('columns.claim'),
      sortValue: (c) => c.goodsReceipt.number ?? '',
      cell: (c) => (
        <Link to={`/supplier-claims/${c.id}`} className="text-accent-text underline">
          {t('claim.title', { receipt: c.goodsReceipt.number ?? '' })}
        </Link>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (c) => c.status,
      cell: (c) => <ClaimStatusBadge status={c.status} />,
    },
    {
      id: 'order',
      head: t('fields.order'),
      sortValue: (c) => c.purchaseOrder.number ?? '',
      cell: (c) => c.purchaseOrder.number ?? NOT_APPLICABLE,
    },
    {
      id: 'claimed',
      head: t('columns.claimed'),
      numeric: true,
      sortValue: (c) => c.claimedPesewas,
      cell: (c) => <MoneyDisplay pesewas={c.claimedPesewas} />,
    },
  ]);
  return (
    <TableCard
      heading={<h2 className="text-lg font-semibold">{t('account.claims')}</h2>}
      view={view}
      query={list}
      labels={labels}
      rows={(page) => page.data}
      rowKey={(row) => row.id}
      tableLabel={t('account.claims')}
      exportName={t('account.claims')}
      pages={{ state: pages, info: (page) => page.page, label: t('account.claimsPages') }}
    />
  );
}

function Payments({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation(['payables', 'common']);
  const pages = useCursorPages();
  const list = useApiQuery('listSupplierPayments', {
    query: { supplierId, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) },
  });
  const labels = useStateLabels({
    loading: t('account.paymentsLoading'),
    emptyTitle: t('account.paymentsEmpty'),
    errorTitle: t('payments.error'),
    deniedTitle: t('payments.denied'),
  });
  const view = useTableView<S['SupplierPayment']>([
    {
      id: 'payment',
      rowHeader: true,
      head: t('columns.payment'),
      sortValue: (p) => p.paymentNo ?? '',
      cell: (p) => (
        <Link to={`/supplier-payments/${p.id}`} className="text-accent-text underline">
          {p.paymentNo ?? t('payment.unnumbered', { supplier: p.supplier.name })}
        </Link>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (p) => p.status,
      cell: (p) => <PaymentStatusBadge status={p.status} />,
    },
    {
      id: 'paidAt',
      head: t('payment.paidAt'),
      sortValue: (p) => p.paidAt ?? '',
      cell: (p) => <When instant={p.paidAt} empty={t('payment.notPaid')} />,
    },
    {
      id: 'amount',
      head: t('columns.amount'),
      numeric: true,
      sortValue: (p) => p.amountPesewas,
      cell: (p) => <MoneyDisplay pesewas={p.amountPesewas} />,
    },
  ]);
  return (
    <TableCard
      heading={<h2 className="text-lg font-semibold">{t('account.payments')}</h2>}
      view={view}
      query={list}
      labels={labels}
      rows={(page) => page.data}
      rowKey={(row) => row.id}
      tableLabel={t('account.payments')}
      exportName={t('account.payments')}
      pages={{ state: pages, info: (page) => page.page, label: t('account.paymentsPages') }}
    />
  );
}
