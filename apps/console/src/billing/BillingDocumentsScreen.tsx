import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  DateRangeMenu,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  ToolbarSearch,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, countSet, FilterSelect, param } from '../stock/filters';
import {
  DOCUMENT_KINDS,
  DocumentStatusBadge,
  PAYMENT_STATUSES,
  PaymentBadge,
  useCustomerWords,
  useDocumentName,
  useKindWords,
  type BillingDocument,
} from './presentation';

/**
 * FR-BIL: every invoice, receipt, proforma, credit note and debit note the person may read, newest first,
 * with the API's totals and billing's payment summary. Every filter is the API's own (`kind`,
 * `paymentStatus`, `from` and `to` on the issue date, `documentNo`, which also finds a till's provisional
 * reference). Nothing is added up: each figure is the document's own.
 */
export function BillingDocumentsScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const rangeWords = useDateRangeWords();
  const documentName = useDocumentName();
  const kindWords = useKindWords();
  const customerWords = useCustomerWords();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [kind, setKind] = useState(ANY);
  const [payment, setPayment] = useState(ANY);
  const [typed, setTyped] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  // A list people browse and filter: `working` (DATA_CONVENTIONS).
  const documents = useApiQuery(
    'listBillingDocuments',
    {
      query: {
        ...(range.from === undefined ? {} : { from: range.from }),
        ...(range.to === undefined ? {} : { to: range.to }),
        ...param('kind', kind),
        ...param('paymentStatus', payment),
        ...(documentNo === '' ? {} : { documentNo }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );
  const filtered = countSet(kind, payment) > 0 || documentNo !== '' || range.from !== undefined;
  const labels = useStateLabels({
    loading: t('list.loading'),
    emptyTitle: filtered ? t('list.emptyFiltered') : t('list.empty'),
    emptyDescription: filtered ? undefined : t('list.emptyBody'),
    errorTitle: t('list.error'),
    deniedTitle: t('list.denied'),
  });
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    pages.reset();
  };
  const columns: TableColumn<BillingDocument>[] = [
    {
      id: 'document',
      rowHeader: true,
      head: t('list.columns.document'),
      sortValue: (document) => document.documentNo ?? document.provisionalRef ?? '',
      cell: (document) => (
        <span className="flex items-center gap-3">
          <IconChip icon={FileText} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link
              to={`/billing-documents/${document.id}`}
              className="break-words text-accent-text underline"
            >
              {documentName(document)}
            </Link>
            {document.status === 'DRAFT' ? (
              <span>
                <DocumentStatusBadge document={document} />
              </span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      id: 'kind',
      head: t('list.columns.kind'),
      sortValue: (document) => kindWords(document.kind),
      cell: (document) => kindWords(document.kind),
    },
    {
      id: 'customer',
      head: t('list.columns.customer'),
      sortValue: (document) => customerWords(document),
      cell: (document) => customerWords(document),
    },
    {
      id: 'issued',
      head: t('list.columns.issued'),
      // ISO dates sort as text.
      sortValue: (document) => document.issueDate,
      cell: (document) => document.issueDate ?? t('doc.facts.notIssued'),
    },
    {
      id: 'gross',
      head: t('list.columns.gross'),
      numeric: true,
      sortValue: (document) => document.grossPesewas,
      cell: (document) => <MoneyDisplay pesewas={document.grossPesewas} />,
    },
    {
      id: 'outstanding',
      head: t('list.columns.outstanding'),
      numeric: true,
      sortValue: (document) => document.settlement.outstandingPesewas,
      cell: (document) => <MoneyDisplay pesewas={document.settlement.outstandingPesewas} />,
    },
    {
      id: 'payment',
      head: t('list.columns.payment'),
      sortValue: (document) => document.settlement.paymentStatus,
      cell: (document) => <PaymentBadge status={document.settlement.paymentStatus} />,
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="billing-title" className="grid gap-4">
      <PageHeader
        title={t('list.title')}
        titleId="billing-title"
        description={t('list.description')}
        actions={
          auth.can('whl.statement.read') ? (
            <Button asChild variant="secondary">
              <Link to="/statements">{t('list.statements')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={documents}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(document) => document.id}
        tableLabel={t('list.table')}
        exportName={t('list.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('list.pages') }}
        toolbar={
          <>
            <ToolbarSearch
              label={t('list.searchLabel')}
              placeholder={t('list.searchPlaceholder')}
              value={typed}
              onValueChange={setTyped}
              onSubmit={(value) => {
                setDocumentNo(value);
                pages.reset();
              }}
            />
            <DateRangeMenu
              label={t('list.dates')}
              summary={rangeWords(range)}
              from={range.from}
              to={range.to}
              onChange={(next) => {
                setRange(next);
                pages.reset();
              }}
              fromLabel={t('common:dates.from')}
              toLabel={t('common:dates.to')}
              clearLabel={t('common:dates.clear')}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={countSet(kind, payment)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setKind(ANY);
                  setPayment(ANY);
                  pages.reset();
                },
              }}
            >
              <FilterSelect
                label={t('list.filters.kind')}
                anyLabel={t('list.filters.anyKind')}
                value={kind}
                onChange={change(setKind)}
                options={DOCUMENT_KINDS.map((value) => ({ value, label: kindWords(value) }))}
              />
              <FilterSelect
                label={t('list.filters.payment')}
                anyLabel={t('list.filters.anyPayment')}
                value={payment}
                onChange={change(setPayment)}
                options={PAYMENT_STATUSES.map((value) => ({
                  value,
                  label: t(`payment.${value}`),
                }))}
              />
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
