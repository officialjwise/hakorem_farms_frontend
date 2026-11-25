import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  MoneyDisplay,
  MutationFailure,
  QueryBoundary,
  formatMoney,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { documentHref } from '../lib/documents';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';

type S = components['schemas'];
type OpenItem = S['OpenItem'];

/** What the server answered a write-off with: it waits for the Owner, and nothing has changed yet. */
interface Waiting {
  approvalId: string;
  summary: string;
  document: string;
  amountPesewas: number;
}

/**
 * The buyer's open documents (`listOpenItems` for the customer): each invoice, receipt or debit note with
 * something still owed, how late it is, and what is owed on it now, as the server works it out; the
 * server's own total under them. A holder of `whl.bad_debt.write_off` asks for what is still owed on one to
 * be written off as bad debt (2.18.0): confirmed first with the exact amount and a reason, it always waits
 * for the Owner, who is not the person asking, and says so on screen until the page is left. A refusal stays
 * on screen in its words with its reference, in the dialog and after it closes.
 */
export function OpenDocuments({ customerId, name }: { customerId: string; name: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const canRead = auth.can('pay.receivable.read');
  const canWriteOff = auth.can('whl.bad_debt.write_off');
  const keyFor = useIntentKey();
  const pages = useCursorPages();
  const items = useApiQuery(
    'listOpenItems',
    { query: { customerId, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) } },
    { enabled: canRead },
  );
  const writeOff = useApiMutation('writeOffBadDebt');
  const [asking, setAsking] = useState<OpenItem | null>(null);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const labels = useStateLabels({
    loading: t('openItems.loading'),
    emptyTitle: t('openItems.empty'),
    emptyDescription: t('openItems.emptyBody'),
    errorTitle: t('openItems.error'),
    deniedTitle: t('openItems.denied'),
  });
  const failure = useStateLabels({
    loading: t('openItems.writeOffSubmit'),
    emptyTitle: t('openItems.notWrittenOff'),
    errorTitle: t('openItems.notWrittenOff'),
    deniedTitle: t('openItems.deniedWriteOff'),
  });
  const documentName = (item: OpenItem) => item.billingDocument.number ?? t('openItems.unnumbered');
  const view = useTableView<OpenItem>([
    {
      id: 'document',
      rowHeader: true,
      head: t('openItems.columns.document'),
      sortValue: (item) => item.billingDocument.number ?? '',
      cell: (item) => {
        const href = documentHref(item.billingDocument);
        const kind = item.billingDocument.docType;
        return (
          <span className="grid">
            {href === undefined ? (
              documentName(item)
            ) : (
              <Link to={href} className="text-accent-text underline">
                {documentName(item)}
              </Link>
            )}
            <span className="text-control-sm text-fg-muted">
              {kind === 'INVOICE' || kind === 'RECEIPT' || kind === 'DEBIT_NOTE'
                ? t(`openItems.docType.${kind}`)
                : kind}
            </span>
          </span>
        );
      },
    },
    {
      id: 'issued',
      head: t('openItems.columns.issued'),
      sortValue: (item) => item.issueDate,
      cell: (item) => item.issueDate,
    },
    {
      id: 'due',
      head: t('openItems.columns.due'),
      sortValue: (item) => item.dueDate ?? '',
      cell: (item) => item.dueDate ?? t('openItems.noDue'),
    },
    {
      id: 'overdue',
      head: t('openItems.columns.overdue'),
      numeric: true,
      sortValue: (item) => item.daysOverdue,
      cell: (item) =>
        item.daysOverdue > 0
          ? t('credit.days', { count: item.daysOverdue })
          : t('openItems.notOverdue'),
    },
    {
      id: 'outstanding',
      head: t('openItems.columns.outstanding'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (item) => item.outstandingPesewas,
      cell: (item) => <MoneyDisplay pesewas={item.outstandingPesewas} />,
    },
    ...(canWriteOff
      ? [
          {
            id: 'actions',
            head: t('openItems.columns.actions'),
            cell: (item: OpenItem) => (
              <Button
                size="sm"
                variant="secondary"
                aria-label={t('openItems.writeOffFor', { document: documentName(item) })}
                onClick={() => {
                  writeOff.reset();
                  setAsking(item);
                }}
              >
                {t('openItems.writeOff')}
              </Button>
            ),
          },
        ]
      : []),
  ]);
  return (
    <section aria-labelledby="open-documents-title" className="grid gap-2">
      <h2 id="open-documents-title" className="text-heading-sm font-semibold">
        {t('openItems.title')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('openItems.intro')}</p>
      {waiting.map((w) => (
        <Alert
          key={w.approvalId}
          severity="warning"
          title={t('openItems.waiting', {
            amount: formatMoney(w.amountPesewas),
            document: w.document,
          })}
        >
          <p>{t('openItems.waitingBody')}</p>
          <p>{w.summary}</p>
          <Link to={`/approvals/${w.approvalId}`} className="text-accent-text underline">
            {t('outcome.openApproval')}
          </Link>
        </Alert>
      ))}
      {asking === null ? (
        <MutationFailure error={shownFailure(writeOff.error)} labels={failure} />
      ) : null}
      {canRead ? (
        <TableCard
          view={view}
          query={items}
          labels={labels}
          rows={(page) => page.data}
          rowKey={(row) => row.billingDocument.id}
          tableLabel={t('openItems.table')}
          exportName={t('openItems.title')}
          pages={{ state: pages, info: (page) => page.page, label: t('openItems.pages') }}
          footer={(page) => (
            <dl className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3">
              <dt>{t('openItems.total')}</dt>
              <dd>
                <MoneyDisplay pesewas={page.totalOutstandingPesewas} strong />
              </dd>
            </dl>
          )}
        />
      ) : (
        <QueryBoundary query={items} labels={labels} denied isEmpty={() => true}>
          {() => null}
        </QueryBoundary>
      )}
      {asking === null ? null : (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setAsking(null);
          }}
          title={t('openItems.writeOffTitle', {
            amount: formatMoney(asking.outstandingPesewas),
            document: documentName(asking),
          })}
          body={t('openItems.writeOffBody', { name, document: documentName(asking) })}
          warning={
            <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
              <dt>{t('openItems.writeOffDocument')}</dt>
              <dd className="text-end">{documentName(asking)}</dd>
              <dt>{t('openItems.writeOffOutstanding')}</dt>
              <dd className="text-end">
                <MoneyDisplay pesewas={asking.outstandingPesewas} />
              </dd>
              <dt className="font-semibold">{t('openItems.writeOffAmount')}</dt>
              <dd className="text-end">
                <MoneyDisplay pesewas={asking.outstandingPesewas} strong />
              </dd>
            </dl>
          }
          fieldLabel={t('openItems.writeOffReason')}
          fieldHint={t('openItems.writeOffReasonHint')}
          submitLabel={t('openItems.writeOffSubmit')}
          destructive
          error={shownFailure(writeOff.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            // All of what is still owed, as the API states it: nothing is worked out here.
            const input = {
              body: {
                billingDocumentId: asking.billingDocument.id,
                amountPesewas: asking.outstandingPesewas,
                reason,
              },
            };
            const answer = await writeOff.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setWaiting((now) => [
              {
                approvalId: answer.approvalRequestId,
                summary: answer.summary,
                document: documentName(asking),
                amountPesewas: asking.outstandingPesewas,
              },
              ...now.filter((w) => w.approvalId !== answer.approvalRequestId),
            ]);
            setAsking(null);
          }}
        />
      )}
    </section>
  );
}
