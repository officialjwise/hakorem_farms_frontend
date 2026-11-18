import { FileMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  formatMoney,
  MoneyDisplay,
  MoneyInput,
  NumberInput,
  QuantityDisplay,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending, type ApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { compareQuantity, toQuantity, useUnits } from '../stock/units';
import type { DocumentNotice } from './BillingDocumentScreen';
import {
  isCorrectable,
  useDocumentName,
  type BillingDocument,
  type BillingLine,
} from './presentation';

/** `CreditNoteCreate.note`: no limit in the contract, so the form keeps it to a paragraph. */
const NOTE_MAX = 500;

type Mode = 'none' | 'quantity' | 'amount';
interface LineEntry {
  mode: Mode;
  quantity: string;
  amount: number | null;
}

/** Reasons for a credit: the REFUND and RETURN codes (issueCreditNote's description). A fixed list: `reference`. */
function useCreditReasons() {
  const refund = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'REFUND', limit: 100 } },
    { staleClass: 'reference' },
  );
  const ret = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'RETURN', limit: 100 } },
    { staleClass: 'reference' },
  );
  const all = [...(refund.data?.items ?? []), ...(ret.data?.items ?? [])].filter(
    (reason, i, list) =>
      (reason.domain === 'REFUND' || reason.domain === 'RETURN') &&
      list.findIndex((other) => other.code === reason.code) === i,
  );
  return { reasons: all, loading: refund.isPending || ret.isPending };
}

/**
 * FR-BIL-007: a credit note against an issued invoice or receipt. Each line of the original is credited by a
 * quantity or by an amount in the original's terms, or not at all. The tax on the credit is the API's,
 * recomputed by the original's tax scheme version, so the confirmation names what is being credited and says
 * that the API works out the rest: nothing is computed here. Raised on its own, a credit note always waits
 * for a second person (202 `CREDIT_NOTE`); the page then says so and links the request.
 */
export function CreditNoteScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const { id = '' } = useParams();
  const document = useApiQuery('getBillingDocument', { path: { id } });
  const labels = useStateLabels({
    loading: t('credit.loading'),
    emptyTitle: t('doc.notFound'),
    errorTitle: t('credit.error'),
    deniedTitle: t('credit.denied'),
  });
  if (document.error?.status === 404) {
    return <EmptyState title={t('doc.notFound')} description={t('common:states.notFoundBody')} />;
  }
  return (
    <QueryBoundary
      query={document}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <CreditNoteForm key={current.id} document={current} />}
    </QueryBoundary>
  );
}

function CreditNoteForm({ document }: { document: BillingDocument }) {
  const { t } = useTranslation(['billing', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const documentName = useDocumentName();
  const name = documentName(document);
  const { reasons, loading } = useCreditReasons();
  const units = useUnits();
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Record<string, LineEntry>>({});
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [waiting, setWaiting] = useState<ApprovalPending | null>(null);
  const issue = useApiMutation('issueCreditNote', {
    invalidates: ['listBillingDocuments', 'listApprovals'],
  });
  const keyFor = useIntentKey();
  const backHref = `/billing-documents/${document.id}`;

  if (!isCorrectable(document)) {
    return (
      <EmptyState
        title={t('credit.notCorrectable')}
        action={
          <Link to={backHref} className="text-accent-text underline">
            {t('credit.cancel')}
          </Link>
        }
      />
    );
  }

  const entryOf = (line: BillingLine): LineEntry =>
    entries[line.id] ?? { mode: 'none', quantity: '', amount: null };
  const change = (line: BillingLine, next: Partial<LineEntry>) =>
    setEntries((now) => ({ ...now, [line.id]: { ...entryOf(line), ...next } }));
  const reason = reasons.find((r) => r.code === reasonCode);
  const noteMissing = reason?.requiresNote === true && note.trim() === '';
  const quantityWrong = (line: BillingLine, entry: LineEntry) => {
    const quantity = toQuantity(entry.quantity);
    return (
      quantity === null ||
      compareQuantity(quantity, '0.000') <= 0 ||
      compareQuantity(quantity, line.quantity) > 0
    );
  };
  const chosen = document.lines.filter((line) => entryOf(line).mode !== 'none');
  const wrongLines = chosen.filter((line) => {
    const entry = entryOf(line);
    return entry.mode === 'quantity'
      ? quantityWrong(line, entry)
      : entry.amount === null || entry.amount <= 0;
  });
  const body = {
    reasonCode,
    ...(note.trim() === '' ? {} : { note: note.trim() }),
    lines: chosen.map((line) => {
      const entry = entryOf(line);
      return entry.mode === 'quantity'
        ? { lineId: line.id, quantity: toQuantity(entry.quantity) ?? '0.000' }
        : { lineId: line.id, amountPesewas: entry.amount ?? 0 };
    }),
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (reasonCode === '' || noteMissing || chosen.length === 0 || wrongLines.length > 0) return;
    issue.reset();
    setConfirming(true);
  };

  if (waiting !== null) {
    return (
      <article aria-labelledby="credit-title" className="grid gap-4">
        <PageHeader title={t('credit.title', { name })} titleId="credit-title" />
        <Alert severity="warning" title={t('credit.waitingTitle')}>
          <p>{t('credit.waitingBody')}</p>
          <p className="flex flex-wrap gap-4">
            {auth.can('iam.approval.read') ? (
              <Link
                to={`/approvals/${waiting.approvalRequestId}`}
                className="text-accent-text underline"
              >
                {t('credit.openRequest')}
              </Link>
            ) : null}
            <Link to={backHref} className="text-accent-text underline">
              {t('credit.cancel')}
            </Link>
          </p>
        </Alert>
      </article>
    );
  }

  return (
    <article aria-labelledby="credit-title" className="grid gap-4">
      <Link to={backHref} className="text-accent-text underline">
        {t('credit.cancel')}
      </Link>
      <PageHeader title={t('credit.title', { name })} titleId="credit-title" />
      <p className="text-fg-muted">{t('credit.intro')}</p>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('credit.reason')}
              hint={loading ? t('credit.reasonsLoading') : t('credit.reasonHint')}
              required
              requiredLabel={t('common:field.required')}
              error={checked && reasonCode === '' ? t('credit.reasonMissing') : undefined}
            >
              <Select
                value={reasonCode}
                onValueChange={setReasonCode}
                placeholder={t('credit.reason')}
                options={reasons.map((r) => ({ value: r.code, label: r.description }))}
              />
            </Field>
            <Field
              label={t('credit.note')}
              hint={t('credit.noteHint')}
              error={checked && noteMissing ? t('credit.noteRequired') : undefined}
            >
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={NOTE_MAX}
                rows={2}
              />
            </Field>
          </CardBody>
        </Card>
        <section aria-labelledby="credit-lines-title" className="grid gap-3">
          <h2 id="credit-lines-title" className="text-xl font-semibold">
            {t('credit.linesTitle')}
          </h2>
          {checked && chosen.length === 0 ? (
            <p role="alert" className="font-semibold text-critical-fg">
              {t('credit.noLines')}
            </p>
          ) : null}
          {document.lines.map((line) => {
            const entry = entryOf(line);
            const number = line.lineNo;
            return (
              <Card key={line.id}>
                <CardBody className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid content-start gap-1">
                    <p className="font-semibold">
                      {t('doc.lines.lineNo', { number })}, {line.description}
                    </p>
                    <p className="text-control-sm text-fg-muted">
                      <QuantityDisplay
                        quantity={line.quantity}
                        unit={units.after(line.uom, line.quantity)}
                        places={units.places(line.uom)}
                      />{' '}
                      · <MoneyDisplay pesewas={line.lineGrossPesewas} />
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <Field label={t('credit.by', { number })}>
                      <Select
                        value={entry.mode}
                        onValueChange={(mode) => change(line, { mode: mode as Mode })}
                        options={[
                          { value: 'none', label: t('credit.byNone') },
                          { value: 'quantity', label: t('credit.byQuantity') },
                          { value: 'amount', label: t('credit.byAmount') },
                        ]}
                      />
                    </Field>
                    {entry.mode === 'quantity' ? (
                      <Field
                        label={t('credit.quantity', { number })}
                        hint={t('credit.quantityHint', { quantity: line.quantity, uom: line.uom })}
                        required
                        requiredLabel={t('common:field.required')}
                        error={
                          checked && quantityWrong(line, entry)
                            ? t('credit.quantityInvalid')
                            : undefined
                        }
                      >
                        <NumberInput
                          value={entry.quantity}
                          onValueChange={(quantity) => change(line, { quantity })}
                          decimals={3}
                        />
                      </Field>
                    ) : null}
                    {entry.mode === 'amount' ? (
                      <Field
                        label={t('credit.amount', { number })}
                        hint={
                          document.taxInclusive
                            ? t('credit.amountHintInclusive', {
                                gross: formatMoney(line.lineGrossPesewas),
                              })
                            : t('credit.amountHintExclusive', {
                                net: formatMoney(line.lineNetPesewas),
                              })
                        }
                        required
                        requiredLabel={t('common:field.required')}
                        error={
                          checked && (entry.amount === null || entry.amount <= 0)
                            ? t('credit.amountInvalid')
                            : undefined
                        }
                      >
                        <MoneyInput
                          value={entry.amount}
                          onValueChange={(amount) => change(line, { amount })}
                        />
                      </Field>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </section>
        <div>
          <Button type="submit">
            <FileMinus aria-hidden="true" />
            {t('credit.review')}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('credit.confirmTitle')}
        body={t('credit.confirmBody')}
        consequence={t('credit.confirmTax')}
        confirmLabel={t('credit.send')}
        pendingLabel={t('credit.pending')}
        pending={issue.isPending}
        error={issue.error}
        failedTitle={t('credit.failed')}
        icon={FileMinus}
        onConfirm={() => {
          issue
            .mutateAsync(
              { path: { id: document.id }, body },
              { idempotencyKey: keyFor({ credit: document.id, ...body }) },
            )
            .then((answer) => {
              setConfirming(false);
              if (isApprovalPending(answer)) {
                setWaiting(answer);
                return;
              }
              const notice: DocumentNotice = { notice: 'creditIssued' };
              void navigate(`/billing-documents/${answer.id}`, { state: notice });
            })
            .catch(() => undefined);
        }}
      >
        <div className="grid gap-2">
          <p className="font-semibold">{name}</p>
          <ul className="grid list-disc gap-1 ps-5">
            {chosen.map((line) => {
              const entry = entryOf(line);
              return (
                <li key={line.id}>
                  {t('credit.confirmLine', { number: line.lineNo, description: line.description })}{' '}
                  {entry.mode === 'quantity' ? (
                    <QuantityDisplay
                      quantity={toQuantity(entry.quantity) ?? '0.000'}
                      unit={units.after(line.uom, toQuantity(entry.quantity) ?? '0.000')}
                      places={units.places(line.uom)}
                    />
                  ) : (
                    <MoneyDisplay pesewas={entry.amount ?? 0} strong />
                  )}
                </li>
              );
            })}
          </ul>
          <p>{t('credit.confirmReason', { reason: reason?.description ?? reasonCode })}</p>
        </div>
      </ConfirmDialog>
    </article>
  );
}
