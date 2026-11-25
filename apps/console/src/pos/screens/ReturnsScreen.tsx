import type { components } from '@hakorem/api-client';
import { Search, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  MoneyDisplay,
  QueryBoundary,
  Select,
  WeightDisplay,
  WeightInput,
} from '@hakorem/ui';
import { useApiAllPages, useApiMutation, useApiQuery } from '../../data/api';
import { isApprovalPending, type ApprovalPending } from '../../lib/approval';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { useIntentKey } from '../../lib/queries';
import { useStateLabels } from '../../lib/states';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { thousandths, toThreePlaces } from '../offline/cart';
import { quantityText } from '../presentation';

type OrderLine = components['schemas']['OrderLine'];
type SalesOrder = components['schemas']['SalesOrder'];
type OrderReturn = components['schemas']['OrderReturn'];
type Disposition = 'RESTOCK' | 'RETURNS_HOLD' | 'WRITE_OFF';
type Destination = 'CASH' | 'ORIGINAL_METHOD';

interface Entered {
  qty: string;
  weightKg: string | null;
  disposition: Disposition;
}

/**
 * A return at the counter, against the original receipt (FR-POS returns; the owner, 2026-11-16: "refunds at
 * the counter are till returns, not credit notes"). Online only (OFFLINE_SYNC section 2): the cashier finds
 * the receipt, enters what comes back, the reason and where the money goes, and confirms. The API works out
 * the refund, issues the credit note and posts the stock (`createReturn`, then `submitReturn`); above the
 * refund limit it waits for a different person (202). Nothing is totalled here.
 */
export function ReturnsScreen() {
  const { t } = useTranslation(['posScreens', 'pos']);
  const online = useOnlineStatus();
  const [typed, setTyped] = useState('');
  const [documentNo, setDocumentNo] = useState<string | null>(null);

  if (!online) {
    return (
      <EmptyState
        icon={Undo2}
        title={t('returns.offline')}
        description={t('returns.offlineBody')}
      />
    );
  }
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h2 className="text-2xl font-bold">{t('returns.title')}</h2>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setDocumentNo(typed.trim() === '' ? null : typed.trim());
        }}
      >
        <Field label={t('returns.receiptNo')} hint={t('returns.receiptNoHint')}>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" size="lg">
          <Search aria-hidden="true" />
          {t('returns.find')}
        </Button>
      </form>
      {documentNo !== null ? <FoundReceipt key={documentNo} documentNo={documentNo} /> : null}
    </div>
  );
}

function FoundReceipt({ documentNo }: { documentNo: string }) {
  const { t } = useTranslation(['posScreens', 'pos']);
  const found = useApiQuery('listBillingDocuments', {
    query: { documentNo, kind: 'RECEIPT', limit: 5 },
  });
  const labels = useStateLabels({
    loading: t('returns.finding'),
    emptyTitle: t('returns.notFound', { number: documentNo }),
    errorTitle: t('returns.findFailed'),
    deniedTitle: t('returns.denied'),
  });
  return (
    <QueryBoundary
      query={found}
      labels={labels}
      isEmpty={(page) => matching(page.data, documentNo) === undefined}
    >
      {(page) => {
        const receipt = matching(page.data, documentNo);
        if (receipt === undefined) return null;
        return receipt.order === null ? (
          <Alert
            severity="warning"
            title={t('returns.noOrder', { number: receipt.documentNo ?? documentNo })}
          />
        ) : (
          <OrderToReturn orderId={receipt.order.id} receiptNo={receipt.documentNo ?? documentNo} />
        );
      }}
    </QueryBoundary>
  );
}

/** The receipt whose number is the one typed: the filter narrows the list, the number decides. */
function matching<T extends { documentNo: string | null }>(
  rows: readonly T[],
  documentNo: string,
): T | undefined {
  const wanted = documentNo.trim().toUpperCase();
  return rows.find((row) => (row.documentNo ?? '').toUpperCase() === wanted);
}

function OrderToReturn({ orderId, receiptNo }: { orderId: string; receiptNo: string }) {
  const { t } = useTranslation(['posScreens', 'pos']);
  const order = useApiQuery('getOrder', { path: { id: orderId } });
  const labels = useStateLabels({
    loading: t('returns.loadingOrder'),
    emptyTitle: t('returns.noLines'),
    errorTitle: t('returns.orderFailed'),
    deniedTitle: t('returns.denied'),
  });
  return (
    <QueryBoundary query={order} labels={labels} isEmpty={(data) => data.lines.length === 0}>
      {(data) => <ReturnForm order={data} receiptNo={receiptNo} />}
    </QueryBoundary>
  );
}

function sold(line: OrderLine): string {
  return line.qtyFulfilled ?? line.qtyOrdered;
}

function ReturnForm({ order, receiptNo }: { order: SalesOrder; receiptNo: string }) {
  const { t } = useTranslation(['posScreens', 'pos']);
  const reasons = useApiAllPages('listReasonCodes', { query: { domain: 'RETURN' } });
  const create = useApiMutation('createReturn', { invalidates: ['listReturns'] });
  const submit = useApiMutation('submitReturn', { invalidates: ['listReturns', 'listApprovals'] });
  const keyFor = useIntentKey();
  const submitKeyFor = useIntentKey();
  const [entered, setEntered] = useState<Record<string, Entered>>({});
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState<Destination>('CASH');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState<OrderReturn | null>(null);
  const [outcome, setOutcome] = useState<OrderReturn | ApprovalPending | null>(null);

  const chosen = order.lines.flatMap((line) => {
    const row = entered[line.id];
    if (row === undefined) return [];
    const qty = toThreePlaces(row.qty);
    if (qty === null || thousandths(qty) === 0n) return [];
    return [{ line, qty, row }];
  });
  const overSold = chosen.some(({ line, qty }) => thousandths(qty) > thousandths(sold(line)));
  const missingWeight = chosen.some(
    ({ line, row }) => line.priceBasis === 'PER_KG' && row.weightKg === null,
  );
  const ready = chosen.length > 0 && !overSold && !missingWeight && reason !== '';
  const reasonRow = (reasons.data?.items ?? []).find((code) => code.code === reason);
  const noteNeeded = reasonRow?.requiresNote === true && note.trim() === '';

  const set = (id: string, change: Partial<Entered>) =>
    setEntered((current) => ({
      ...current,
      [id]: { qty: '', weightKg: null, disposition: 'RESTOCK', ...current[id], ...change },
    }));

  if (outcome !== null) {
    return isApprovalPending(outcome) ? (
      <Alert severity="info" title={t('returns.pendingTitle')}>
        {t('returns.pendingBody')}
      </Alert>
    ) : (
      <Alert severity="good" title={t('returns.doneTitle', { number: outcome.returnNo ?? '' })}>
        {t('returns.doneRefund')} <MoneyDisplay pesewas={outcome.totalRefundPesewas} />
        {outcome.creditNote !== null
          ? `. ${t('returns.doneCreditNote', { number: outcome.creditNote.number ?? '' })}`
          : ''}
      </Alert>
    );
  }

  const send = (orderReturn: OrderReturn) =>
    submit
      .mutateAsync(
        { path: { id: orderReturn.id } },
        { idempotencyKey: submitKeyFor({ submit: orderReturn.id }) },
      )
      .then((answer) => {
        setConfirming(false);
        setOutcome(answer as OrderReturn | ApprovalPending);
      });

  return (
    <section aria-labelledby="return-title" className="grid gap-4">
      <h3 id="return-title" className="text-lg font-semibold">
        {t('returns.against', { number: receiptNo, order: order.orderNo ?? '' })}
      </h3>
      <ul className="grid gap-3">
        {order.lines.map((line) => {
          const row = entered[line.id];
          const qty = row === undefined ? null : toThreePlaces(row.qty);
          const tooMany = qty !== null && thousandths(qty) > thousandths(sold(line));
          return (
            <li key={line.id} className="grid gap-2 rounded-md border border-border bg-surface p-3">
              <p className="font-semibold">
                {line.product.name}
                {line.stockUnit !== null ? ` ${line.stockUnit.identifier}` : ''}
              </p>
              <p className="text-sm text-fg-muted">
                <code>{line.product.sku}</code>
              </p>
              <p className="text-sm text-fg-muted">
                {t('returns.sold', { quantity: quantityText(sold(line), line.uom) })}
                {line.fulfilledWeightKg !== null ? (
                  <>
                    {' · '}
                    <WeightDisplay
                      kilograms={line.fulfilledWeightKg}
                      notApplicableLabel={t('pos:line.noWeight')}
                    />
                  </>
                ) : null}
                {line.finalLineTotalPesewas !== null ? (
                  <>
                    {' · '}
                    <MoneyDisplay pesewas={line.finalLineTotalPesewas} />
                  </>
                ) : null}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field
                  label={t('returns.qty', { name: line.product.name })}
                  error={tooMany ? t('returns.tooMany') : undefined}
                >
                  <Input
                    inputMode="decimal"
                    value={row?.qty ?? ''}
                    onChange={(event) => set(line.id, { qty: event.target.value })}
                  />
                </Field>
                {line.priceBasis === 'PER_KG' ? (
                  <Field
                    label={t('returns.weight', { name: line.product.name })}
                    error={
                      tried && qty !== null && row?.weightKg == null
                        ? t('pos:line.errors.weight')
                        : undefined
                    }
                  >
                    <WeightInput
                      value={row?.weightKg ?? null}
                      onValueChange={(value) => set(line.id, { weightKg: value })}
                    />
                  </Field>
                ) : null}
                <Field label={t('returns.disposition', { name: line.product.name })}>
                  <Select
                    value={row?.disposition ?? 'RESTOCK'}
                    onValueChange={(value) => set(line.id, { disposition: value as Disposition })}
                    options={(['RESTOCK', 'RETURNS_HOLD', 'WRITE_OFF'] as const).map((value) => ({
                      value,
                      label: t(`returns.dispositions.${value}`),
                    }))}
                  />
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
      <Field
        label={t('returns.reason')}
        error={tried && reason === '' ? t('returns.reasonError') : undefined}
      >
        <Select
          value={reason}
          onValueChange={setReason}
          placeholder={t('returns.reasonPlaceholder')}
          options={(reasons.data?.items ?? []).map((code) => ({
            value: code.code,
            label: code.description,
          }))}
        />
      </Field>
      <Field label={t('returns.destination')}>
        <Select
          value={destination}
          onValueChange={(value) => setDestination(value as Destination)}
          options={(['CASH', 'ORIGINAL_METHOD'] as const).map((value) => ({
            value,
            label: t(`returns.destinations.${value}`),
          }))}
        />
      </Field>
      <Field
        label={t('returns.note')}
        error={tried && noteNeeded ? t('returns.noteError') : undefined}
      >
        <Input value={note} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
      </Field>
      {tried && chosen.length === 0 ? (
        <Alert severity="warning" title={t('returns.nothing')} />
      ) : null}
      <Button
        size="lg"
        onClick={() => {
          setTried(true);
          if (ready && !noteNeeded) setConfirming(true);
        }}
      >
        <Undo2 aria-hidden="true" />
        {t('returns.review')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('returns.confirmTitle')}
        body={t('returns.confirmBody', { destination: t(`returns.destinations.${destination}`) })}
        consequence={t('returns.consequence')}
        confirmLabel={t('returns.confirm')}
        pendingLabel={t('returns.sending')}
        pending={create.isPending || submit.isPending}
        error={submit.error ?? create.error}
        failedTitle={t('returns.failed')}
        onConfirm={() => {
          if (created !== null) {
            void send(created).catch(() => undefined);
            return;
          }
          const body = {
            orderId: order.id,
            kind: 'RETURN' as const,
            reasonCode: reason,
            refundDestination: destination,
            lines: chosen.map(({ line, qty, row }) => ({
              orderLineId: line.id,
              qty,
              ...(row.weightKg !== null ? { weightKg: row.weightKg } : {}),
              disposition: row.disposition,
            })),
            ...(note.trim() !== '' ? { note: note.trim() } : {}),
          };
          create
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then((orderReturn) => {
              setCreated(orderReturn);
              return send(orderReturn);
            })
            .catch(() => undefined);
        }}
      >
        <ul className="grid gap-1">
          {chosen.map(({ line, qty, row }) => (
            <li key={line.id}>
              {t('returns.confirmLine', {
                name: line.product.name,
                quantity: quantityText(qty, line.uom),
                disposition: t(`returns.dispositions.${row.disposition}`),
              })}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </section>
  );
}
