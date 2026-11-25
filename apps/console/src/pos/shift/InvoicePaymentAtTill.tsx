import type { components } from '@hakorem/api-client';
import { FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  QueryBoundary,
  type FailureLike,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../../data/api';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { useIntentKey } from '../../lib/queries';
import { RequestReference } from '../../lib/RequestReference';
import { useStateLabels } from '../../lib/states';
import type { ShiftRecord } from '../offline/types';
import { payableAtTill } from './invoicePayment';

type BillingDocument = components['schemas']['BillingDocument'];
type TillInvoicePayment = components['schemas']['TillInvoicePayment'];

/**
 * A customer pays an issued invoice in cash at the till (2.26.0, `payInvoiceAtTill`), and a guest pays what is
 * left on an order's receipt (2.36.0). Taken onto the cashier's own open shift, online only: the operation is
 * not in the offline batch. The cashier finds the document by its number (`listBillingDocuments`, which the
 * Cashier holds), enters what is paid and what was handed over, confirms the exact amounts, and the server's
 * answer stays on screen: the change to give back and what is still outstanding, both the server's. The cash
 * goes into this drawer and is counted at the close. Nothing is totalled here.
 */
export function InvoicePaymentAtTill({ shift, online }: { shift: ShiftRecord; online: boolean }) {
  const { t } = useTranslation('posShift');
  const [typed, setTyped] = useState('');
  const [documentNo, setDocumentNo] = useState<string | null>(null);
  const [done, setDone] = useState<TillInvoicePayment[]>([]);
  const canAsk = online && shift.confirmed;

  return (
    <section
      aria-labelledby="invoice-payment-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
      data-slot="invoice-payment"
    >
      <h3 id="invoice-payment-title" className="flex items-center gap-2 text-lg font-semibold">
        <FileText aria-hidden="true" className="size-icon-md" />
        {t('invoicePayment.title')}
      </h3>
      <p>{t('invoicePayment.body')}</p>
      {done.map((answer) => (
        <Paid key={answer.paymentId} answer={answer} />
      ))}
      {!canAsk ? (
        <Alert
          severity="warning"
          title={online ? t('invoicePayment.notOnServer') : t('invoicePayment.offline')}
        />
      ) : (
        <>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setDocumentNo(typed.trim() === '' ? null : typed.trim());
            }}
          >
            <Field label={t('invoicePayment.documentNo')} hint={t('invoicePayment.documentNoHint')}>
              <Input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button type="submit" size="lg" variant="secondary">
              <Search aria-hidden="true" />
              {t('invoicePayment.find')}
            </Button>
          </form>
          {documentNo !== null ? (
            <FoundDocument
              key={documentNo}
              documentNo={documentNo}
              shift={shift}
              onPaid={(answer) => {
                setDone((current) => [answer, ...current]);
                setTyped('');
                setDocumentNo(null);
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function FoundDocument({
  documentNo,
  shift,
  onPaid,
}: {
  documentNo: string;
  shift: ShiftRecord;
  onPaid: (answer: TillInvoicePayment) => void;
}) {
  const { t } = useTranslation('posShift');
  const found = useApiQuery(
    'listBillingDocuments',
    { query: { documentNo, limit: 5 } },
    { staleClass: 'live' },
  );
  const labels = useStateLabels({
    loading: t('invoicePayment.finding'),
    emptyTitle: t('invoicePayment.notFound', { number: documentNo }),
    errorTitle: t('invoicePayment.findFailed'),
    deniedTitle: t('invoicePayment.denied'),
  });
  return (
    <QueryBoundary
      query={found}
      labels={labels}
      isEmpty={(page) => matching(page.data, documentNo) === undefined}
    >
      {(page) => {
        const document = matching(page.data, documentNo);
        if (document === undefined) return null;
        return <PayDocument document={document} shift={shift} onPaid={onPaid} />;
      }}
    </QueryBoundary>
  );
}

function PayDocument({
  document,
  shift,
  onPaid,
}: {
  document: BillingDocument;
  shift: ShiftRecord;
  onPaid: (answer: TillInvoicePayment) => void;
}) {
  const { t } = useTranslation('posShift');
  const pay = useApiMutation('payInvoiceAtTill', {
    invalidates: ['getShift', 'getShiftXReport', 'listBillingDocuments', 'getBillingDocument'],
  });
  const keyFor = useIntentKey();
  const [amount, setAmount] = useState<number | null>(null);
  const [tendered, setTendered] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const outstanding = document.settlement.outstandingPesewas;
  const number = document.documentNo ?? '';
  const notPayable = payableAtTill(document);
  // Checks only: the server judges the payment again, and works out the change.
  const amountError =
    amount === null || amount <= 0
      ? t('invoicePayment.amountError')
      : amount > outstanding
        ? t('invoicePayment.amountOver')
        : undefined;
  const tenderedError =
    tendered !== null && amount !== null && tendered < amount
      ? t('invoicePayment.tenderedBelow')
      : undefined;
  const ready = amountError === undefined && tenderedError === undefined;

  return (
    <div className="grid gap-3" data-slot="invoice-found">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>{t(`invoicePayment.kind.${document.kind === 'RECEIPT' ? 'RECEIPT' : 'INVOICE'}`)}</dt>
        <dd className="text-end font-semibold">{number}</dd>
        <dt>{t('invoicePayment.customer')}</dt>
        <dd className="text-end">{document.customerName ?? t('invoicePayment.guest')}</dd>
        <dt>{t('invoicePayment.gross')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={document.grossPesewas} />
        </dd>
        <dt>{t('invoicePayment.outstanding')}</dt>
        <dd className="text-end font-semibold">
          <MoneyDisplay pesewas={outstanding} />
        </dd>
      </dl>
      {notPayable !== null ? (
        <Alert severity="warning" title={t(`invoicePayment.notPayable.${notPayable}`)} />
      ) : (
        <>
          <Field
            label={t('invoicePayment.amount')}
            hint={t('invoicePayment.amountHint')}
            error={tried ? amountError : undefined}
          >
            <MoneyInput
              value={amount}
              onValueChange={(value) => {
                setAmount(value);
                pay.reset();
              }}
            />
          </Field>
          <Field
            label={t('invoicePayment.tendered')}
            hint={t('invoicePayment.tenderedHint')}
            error={tried ? tenderedError : undefined}
          >
            <MoneyInput
              value={tendered}
              onValueChange={(value) => {
                setTendered(value);
                pay.reset();
              }}
            />
          </Field>
          <Button
            size="lg"
            onClick={() => {
              setTried(true);
              pay.reset();
              if (ready) setConfirming(true);
            }}
          >
            {t('invoicePayment.review')}
          </Button>
        </>
      )}
      {!confirming ? <Refused title={t('invoicePayment.failed')} error={pay.error} /> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('invoicePayment.confirmTitle')}
        body={t('invoicePayment.confirmBody', { number })}
        consequence={t('invoicePayment.consequence')}
        confirmLabel={t('invoicePayment.confirm')}
        pendingLabel={t('invoicePayment.sending')}
        pending={pay.isPending}
        error={pay.error}
        failedTitle={t('invoicePayment.failed')}
        onConfirm={() => {
          if (amount === null) return;
          const body = {
            billingDocumentId: document.id,
            amountPesewas: amount,
            ...(tendered !== null ? { tenderedPesewas: tendered } : {}),
          };
          pay
            .mutateAsync(
              { path: { id: shift.id }, body },
              { idempotencyKey: keyFor({ shift: shift.id, ...body }) },
            )
            .then((answer) => {
              setConfirming(false);
              onPaid(answer);
            })
            .catch(() => undefined);
        }}
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>{t('invoicePayment.documentNo')}</dt>
          <dd className="text-end">{number}</dd>
          <dt>{t('invoicePayment.amount')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={amount ?? 0} />
          </dd>
          <dt>{t('invoicePayment.tendered')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={tendered ?? amount ?? 0} />
          </dd>
        </dl>
      </ConfirmDialog>
    </div>
  );
}

/** The server's answer, kept on screen: the change to give back and what the document still has outstanding. */
function Paid({ answer }: { answer: TillInvoicePayment }) {
  const { t } = useTranslation('posShift');
  return (
    <div
      className="grid gap-2 rounded-md border border-border p-3"
      data-slot="invoice-paid"
      role="status"
    >
      <p className="font-semibold">
        {t('invoicePayment.done', { number: answer.billingDocument.documentNo })}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>{t('invoicePayment.paid')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.amountPesewas} />
        </dd>
        <dt>{t('invoicePayment.tendered')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.tenderedPesewas} />
        </dd>
        <dt>{t('invoicePayment.change')}</dt>
        <dd className="text-end font-semibold">
          <MoneyDisplay pesewas={answer.changeDuePesewas} />
        </dd>
        <dt>{t('invoicePayment.stillOutstanding')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.outstandingPesewas} />
        </dd>
      </dl>
    </div>
  );
}

function Refused({ title, error }: { title: string; error: FailureLike | null }) {
  const { t } = useTranslation('pos');
  if (error === null) return null;
  return (
    <Alert severity="critical" title={title}>
      {error.message}
      {error.correlationId !== '' ? (
        <>
          {' '}
          {t('referenceLabel')} <RequestReference value={error.correlationId} />
        </>
      ) : null}
    </Alert>
  );
}

function matching(
  rows: readonly BillingDocument[],
  documentNo: string,
): BillingDocument | undefined {
  const wanted = documentNo.trim().toUpperCase();
  return rows.find((row) => (row.documentNo ?? '').toUpperCase() === wanted);
}
