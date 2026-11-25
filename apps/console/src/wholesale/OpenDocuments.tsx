import { Scale } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  Field,
  MoneyDisplay,
  MoneyInput,
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
 * server's own total under them. A holder of `whl.bad_debt.write_off` asks for all or part of what is
 * still owed on one to be written off as bad debt (2.18.0; the owner, 2026-11-25): first the amount, at most
 * what is owed, then a confirmation with the exact amount, whether it is all or part, and a reason. It always
 * waits for the Owner, who is not the person asking, and says so on screen until the page is left. A refusal
 * stays on screen in its words with its reference, in the dialog and after it closes.
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
  // The document chosen, then the amount chosen for it: the amount step, then the confirmation.
  const [choosing, setChoosing] = useState<OpenItem | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState<{ item: OpenItem; amountPesewas: number } | null>(null);
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
                  setAmount(item.outstandingPesewas);
                  setTried(false);
                  setChoosing(item);
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
      {asking === null && choosing === null ? (
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
      {choosing === null ? null : (
        <WriteOffAmount
          item={choosing}
          document={documentName(choosing)}
          amount={amount}
          onAmount={setAmount}
          tried={tried}
          onCancel={() => setChoosing(null)}
          onNext={() => {
            setTried(true);
            // Compared with what the API says is owed, never worked out: the server judges it again.
            if (amount === null || amount <= 0 || amount > choosing.outstandingPesewas) return;
            writeOff.reset();
            setAsking({ item: choosing, amountPesewas: amount });
            setChoosing(null);
          }}
        />
      )}
      {asking === null ? null : (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setAsking(null);
          }}
          title={t('openItems.writeOffTitle', {
            amount: formatMoney(asking.amountPesewas),
            document: documentName(asking.item),
          })}
          body={t('openItems.writeOffBody', { name, document: documentName(asking.item) })}
          warning={
            <div className="grid gap-2">
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
                <dt>{t('openItems.writeOffDocument')}</dt>
                <dd className="text-end">{documentName(asking.item)}</dd>
                <dt>{t('openItems.writeOffOutstanding')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={asking.item.outstandingPesewas} />
                </dd>
                <dt className="font-semibold">{t('openItems.writeOffAmount')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={asking.amountPesewas} strong />
                </dd>
              </dl>
              <p className="font-semibold" data-slot="write-off-extent">
                {asking.amountPesewas === asking.item.outstandingPesewas
                  ? t('openItems.writeOffAll')
                  : t('openItems.writeOffPart')}
              </p>
              <p data-slot="write-off-approval">{t('openItems.writeOffApproval')}</p>
            </div>
          }
          fieldLabel={t('openItems.writeOffReason')}
          fieldHint={t('openItems.writeOffReasonHint')}
          submitLabel={t('openItems.writeOffSubmit')}
          destructive
          error={shownFailure(writeOff.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            // The amount chosen, all or part of what the API says is owed: nothing is worked out here.
            const input = {
              body: {
                billingDocumentId: asking.item.billingDocument.id,
                amountPesewas: asking.amountPesewas,
                reason,
              },
            };
            const answer = await writeOff.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setWaiting((now) => [
              {
                approvalId: answer.approvalRequestId,
                summary: answer.summary,
                document: documentName(asking.item),
                amountPesewas: asking.amountPesewas,
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

/**
 * The first step of a write-off: how much, all of what is owed or part of it. It starts at all of it, and
 * takes no more than the API says is owed and nothing below a pesewa; the server checks both again
 * (`NOT_POSITIVE`, `MORE_THAN_OUTSTANDING`).
 */
function WriteOffAmount({
  item,
  document,
  amount,
  onAmount,
  tried,
  onCancel,
  onNext,
}: {
  item: OpenItem;
  document: string;
  amount: number | null;
  onAmount: (amount: number | null) => void;
  tried: boolean;
  onCancel: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const owed = item.outstandingPesewas;
  const error =
    amount === null || amount <= 0
      ? t('openItems.writeOffAmountMissing')
      : amount > owed
        ? t('openItems.writeOffAmountOver', { amount: formatMoney(owed) })
        : undefined;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={t('openItems.writeOffHowMuch', { document })}
      description={t('openItems.writeOffHowMuchBody', { amount: formatMoney(owed) })}
      closeLabel={t('common:actions.close')}
      icon={Scale}
      footer={
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onCancel}>
          <Button onClick={onNext}>{t('openItems.writeOffNext')}</Button>
        </DialogActions>
      }
    >
      <div className="grid gap-3">
        <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
          <dt>{t('openItems.writeOffDocument')}</dt>
          <dd className="text-end">{document}</dd>
          <dt>{t('openItems.writeOffOutstanding')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={owed} />
          </dd>
        </dl>
        <Field
          label={t('openItems.writeOffAmount')}
          hint={t('openItems.writeOffAmountHint')}
          error={tried ? error : undefined}
        >
          <MoneyInput value={amount} onValueChange={onAmount} />
        </Field>
        {amount === owed ? null : (
          <div>
            <Button variant="secondary" size="sm" onClick={() => onAmount(owed)}>
              {t('openItems.writeOffWhole', { amount: formatMoney(owed) })}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
