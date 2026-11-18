import { Banknote, CheckCircle2, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  Select,
} from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useApiMutation } from '../../data/api';
import { newRecordId } from '../../lib/clientId';
import { requestedOn } from '../../requested/switch';
import {
  cartTotal,
  lineAmount,
  splitTender,
  type CartLine,
  type OtherTender,
} from '../offline/cart';
import { getTill, useTill } from '../offline/till';
import type { OfflinePack, PinApprovalRecord, SaleEntry } from '../offline/types';
import { approvers } from '../pin/pin';
import { PinApprovalField } from '../pin/PinCheck';
import { tenderMethods } from './catalogue';
import { RequestReference } from '../../lib/RequestReference';

type PaymentMethodRef = components['schemas']['PaymentMethodRef'];
type Payment = components['schemas']['Payment'];

/** A tender other than cash, taken before cash pays the rest: cleared online, or unverified offline. */
interface ClearedTender {
  key: string;
  method: PaymentMethodRef;
  paymentMethodId: string;
  amountPesewas: number;
  paymentId?: string;
  unverifiedMobileMoney?: OtherTender['unverifiedMobileMoney'];
  /** What the cashier and the confirmation read. */
  label: string;
  /** The supervisor's PIN that approved an unverified tender (CR-032). */
  approval?: PinApprovalRecord;
}

/**
 * Taking payment (FR-POS split tender): cash, and, while online, mobile money the customer approves on
 * their phone, which counts only once the provider has cleared it (a verified payment). Offline the till
 * takes only the pack's offline methods: cash, and mobile money only where the pack lists it, as an
 * unverified tender a supervisor approves with their PIN (OFFLINE_SYNC 5.3, CR-032). Change comes from
 * cash only. The customer's phone, if given, takes the digital receipt (ADR 0045). Then a confirmation with
 * every amount before anything is written (BUILD_PROMPT), and the sale is queued.
 */
export function PayDialog({
  lines,
  pack,
  online,
  shiftId,
  onClose,
  onDone,
}: {
  lines: CartLine[];
  pack: OfflinePack;
  online: boolean;
  /** The open shift as the server holds it, which a mobile money charge counts in (2.6.0); null before. */
  shiftId: string | null;
  onClose: () => void;
  onDone: (entry: SaleEntry) => void;
}) {
  const { t } = useTranslation('pos');
  const auth = useAuth();
  const total = cartTotal(lines);
  const methods = tenderMethods(pack, online);
  const cash = methods.find((method) => method.kind === 'CASH') ?? null;
  const momo = methods.find((method) => method.kind === 'MOBILE_MONEY') ?? null;
  const [cleared, setCleared] = useState<ClearedTender[]>([]);
  const [handed, setHanded] = useState<number | null>(null);
  const [step, setStep] = useState<'tender' | 'confirm'>('tender');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const phone = customerPhone.replace(/\s+/g, '');
  const phoneOk = phone === '' || PHONE.test(phone);

  const split = splitTender(total, cleared, handed ?? 0);
  const canReview =
    cash !== null && !split.otherExceedsTotal && split.shortPesewas === 0 && phoneOk;

  const complete = () => {
    if (cash === null) return;
    setSaving(true);
    setFailed(null);
    getTill()
      .completeSale({
        lines,
        cashMethod: cash,
        others: cleared.map(
          ({ method, paymentMethodId, amountPesewas, paymentId, unverifiedMobileMoney }) => ({
            method,
            paymentMethodId,
            amountPesewas,
            ...(paymentId !== undefined ? { paymentId } : {}),
            ...(unverifiedMobileMoney !== undefined ? { unverifiedMobileMoney } : {}),
          }),
        ),
        cashHandedPesewas: handed ?? 0,
        customerPhone: phone === '' ? null : phone,
        approvals: cleared.flatMap((tender) => (tender.approval ? [tender.approval] : [])),
      })
      .then(onDone)
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={step === 'tender' ? t('pay.title') : t('pay.confirmTitle')}
      description={step === 'tender' ? t('pay.body') : t('pay.confirmBody')}
      closeLabel={t('close')}
      icon={Banknote}
      footer={
        step === 'tender' ? (
          <DialogActions cancelLabel={t('pay.back')} onCancel={onClose}>
            <Button disabled={!canReview} onClick={() => setStep('confirm')}>
              {t('pay.review')}
            </Button>
          </DialogActions>
        ) : (
          <DialogActions cancelLabel={t('pay.change')} onCancel={() => setStep('tender')}>
            <Button loading={saving} loadingLabel={t('pay.saving')} onClick={complete}>
              <CheckCircle2 aria-hidden="true" />
              {t('pay.complete')}
            </Button>
          </DialogActions>
        )
      }
    >
      <div className="grid gap-4">
        <p className="flex items-baseline justify-between text-xl font-bold">
          <span>{t('pay.total')}</span>
          <MoneyDisplay pesewas={total} />
        </p>
        {cash === null ? <Alert severity="critical" title={t('pay.noCash')} /> : null}
        {step === 'tender' ? (
          <>
            {cleared.map((tender) => (
              <p key={tender.key} className="flex flex-wrap justify-between gap-2">
                <span>{tender.label}</span>
                <MoneyDisplay pesewas={tender.amountPesewas} />
              </p>
            ))}
            {momo !== null && !online ? (
              <UnverifiedMobileMoney
                method={momo}
                remaining={split.cashAppliedPesewas}
                onTaken={(tender) => setCleared((current) => [...current, tender])}
              />
            ) : momo !== null && auth.can('pay.payment.initiate') ? (
              <MobileMoney
                method={momo}
                shiftId={shiftId}
                remaining={split.cashAppliedPesewas}
                onCleared={(tender) => setCleared((current) => [...current, tender])}
              />
            ) : (
              <p className="text-sm text-fg-muted">
                {online ? t('pay.cashOnly') : t('pay.offlineCashOnly')}
              </p>
            )}
            <Field label={t('pay.handed')} hint={t('pay.handedHint')}>
              <MoneyInput value={handed} onValueChange={setHanded} />
            </Field>
            <Field
              label={t('pay.phone')}
              hint={t('pay.phoneHint')}
              error={phoneOk ? undefined : t('pay.phoneError')}
            >
              <Input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt>{t('pay.cashDue')}</dt>
              <dd className="text-end">
                <MoneyDisplay pesewas={split.cashAppliedPesewas} />
              </dd>
              <dt className="font-semibold">{t('pay.changeDue')}</dt>
              <dd className="text-end font-semibold" data-slot="change-due">
                <MoneyDisplay pesewas={split.changePesewas} />
              </dd>
            </dl>
            {split.shortPesewas > 0 && handed !== null ? (
              <Alert severity="warning" title={t('pay.short')}>
                <MoneyDisplay pesewas={split.shortPesewas} />
              </Alert>
            ) : null}
            {split.otherExceedsTotal ? (
              <Alert severity="critical" title={t('pay.tooMuch')} />
            ) : null}
          </>
        ) : (
          <>
            <ul className="grid gap-1" aria-label={t('pay.lines')}>
              {lines.map((line) => (
                <li key={line.key} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {line.stockUnitIdentifier !== null
                      ? `${line.productName} ${line.stockUnitIdentifier}`
                      : line.productName}
                  </span>
                  <MoneyDisplay pesewas={lineAmount(line)} />
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-2">
              {cleared.map((tender) => (
                <Row key={tender.key} term={tender.label} pesewas={tender.amountPesewas} />
              ))}
              {split.cashAppliedPesewas > 0 || cleared.length === 0 ? (
                <>
                  <Row term={t('pay.cash')} pesewas={split.cashAppliedPesewas} />
                  <Row term={t('pay.handed')} pesewas={handed ?? 0} />
                </>
              ) : null}
              <Row term={t('pay.changeDue')} pesewas={split.changePesewas} strong />
            </dl>
            {phone !== '' ? <p>{t('pay.phoneConfirm', { phone })}</p> : null}
            <p className="text-sm">{online ? t('pay.sendsNow') : t('pay.queuedOffline')}</p>
            {failed !== null ? (
              <Alert severity="critical" title={t('pay.failed')}>
                {failed}
              </Alert>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

function Row({
  term,
  pesewas,
  strong = false,
}: {
  term: string;
  pesewas: number;
  strong?: boolean;
}) {
  return (
    <>
      <dt className={strong ? 'font-semibold' : undefined}>{term}</dt>
      <dd className={strong ? 'text-end font-semibold' : 'text-end'}>
        <MoneyDisplay pesewas={pesewas} />
      </dd>
    </>
  );
}

const NETWORKS = ['MTN', 'TELECEL', 'AIRTELTIGO'] as const;
const PHONE = /^\+[1-9][0-9]{7,14}$/;

/**
 * A mobile money tender: the request goes to the customer's phone (`initiateMobileMoneyCharge`), and it
 * counts only when the provider has cleared it (`checkPaymentStatus`). It names the till's shift once the
 * server holds it, so the charge shows on the shift's X and Z reports (2.6.0). A refusal stays here in words.
 */
function MobileMoney({
  method,
  shiftId,
  remaining,
  onCleared,
}: {
  method: PaymentMethodRef;
  shiftId: string | null;
  remaining: number;
  onCleared: (tender: ClearedTender) => void;
}) {
  const { t } = useTranslation('pos');
  const [amount, setAmount] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('MTN');
  const [paymentId, setPaymentId] = useState(() => newRecordId());
  const [payment, setPayment] = useState<Payment | null>(null);
  const initiate = useApiMutation('initiateMobileMoneyCharge');
  const check = useApiMutation('checkPaymentStatus');
  const phoneValid = PHONE.test(phone.replace(/\s+/g, ''));
  const error = initiate.error ?? check.error;

  const take = (answer: Payment) => {
    setPayment(answer);
    if (answer.status === 'CLEARED') {
      onCleared({
        key: answer.id,
        method,
        paymentMethodId: method.id,
        amountPesewas: answer.amountPesewas,
        paymentId: answer.id,
        // A readable reference only: never the payment's id (owner, 2026-11-17).
        label: ((reference) =>
          reference === null
            ? t('pay.clearedNoReference', { name: method.name })
            : t('pay.cleared', { name: method.name, reference }))(
          answer.paymentNo ?? answer.providerReference,
        ),
      });
      setPayment(null);
      setAmount(null);
      setPaymentId(newRecordId());
    }
  };

  return (
    <fieldset className="grid gap-3 rounded-md border border-border p-3">
      <legend className="px-1 font-semibold">
        <Smartphone aria-hidden="true" className="me-1 inline size-icon-md" />
        {method.name}
      </legend>
      {payment === null ? (
        <>
          <Field label={t('momo.amount')}>
            <MoneyInput value={amount} onValueChange={setAmount} />
          </Field>
          <Field label={t('momo.phone')} hint={t('momo.phoneHint')}>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t('momo.network')}>
            <Select
              value={network}
              onValueChange={(value) => setNetwork(value as (typeof NETWORKS)[number])}
              options={NETWORKS.map((value) => ({ value, label: t(`momo.networks.${value}`) }))}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={amount === null || amount === 0 || amount > remaining || !phoneValid}
            loading={initiate.isPending}
            loadingLabel={t('momo.sending')}
            onClick={() => {
              if (amount === null) return;
              initiate
                .mutateAsync(
                  {
                    body: {
                      id: paymentId,
                      amountPesewas: amount,
                      payerPhone: phone.replace(/\s+/g, ''),
                      network,
                      ...(shiftId === null ? {} : { shiftId }),
                    },
                  },
                  { idempotencyKey: paymentId },
                )
                .then(take)
                .catch(() => undefined);
            }}
          >
            {t('momo.send')}
          </Button>
        </>
      ) : (
        <>
          <p role="status">
            {payment.status === 'FAILED'
              ? t('momo.failedBody')
              : t('momo.pendingBody', { phone: payment.payerPhoneMasked ?? '' })}
          </p>
          <p className="flex justify-between">
            <span>{t('momo.amount')}</span>
            <MoneyDisplay pesewas={payment.amountPesewas} />
          </p>
          <div className="flex flex-wrap gap-2">
            {payment.status === 'PENDING' ? (
              <Button
                variant="secondary"
                loading={check.isPending}
                loadingLabel={t('momo.checking')}
                onClick={() => {
                  check
                    .mutateAsync({ path: { id: payment.id } })
                    .then(take)
                    .catch(() => undefined);
                }}
              >
                {t('momo.check')}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                setPayment(null);
                setPaymentId(newRecordId());
              }}
            >
              {t('momo.drop')}
            </Button>
          </div>
        </>
      )}
      {error !== null ? (
        <Alert severity="critical" title={t('momo.refused')}>
          {error.message}
          {error.correlationId !== '' ? (
            <>
              {' '}
              {t('referenceLabel')} <RequestReference value={error.correlationId} />
            </>
          ) : null}
        </Alert>
      ) : null}
    </fieldset>
  );
}

/**
 * Mobile money with no network (OFFLINE_SYNC 5.3 and 9.9): offered only where the pack lists the method
 * offline (the branch's setting), and taken only on a supervisor's PIN checked on this till (CR-032). The
 * receipt says it is not yet verified; the server puts it on the unmatched payment queue.
 */
function UnverifiedMobileMoney({
  method,
  remaining,
  onTaken,
}: {
  method: PaymentMethodRef;
  remaining: number;
  onTaken: (tender: ClearedTender) => void;
}) {
  const { t } = useTranslation('pos');
  const { snapshot } = useTill();
  const [amount, setAmount] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('MTN');
  const [reference, setReference] = useState('');
  const [round, setRound] = useState(0);
  const localAuth = snapshot?.localAuth ?? null;
  const payer = phone.replace(/\s+/g, '');
  const ready = amount !== null && amount > 0 && amount <= remaining && PHONE.test(payer);

  if (!requestedOn('CR-032') || localAuth === null) {
    return <p className="text-sm text-fg-muted">{t('unverified.unavailable')}</p>;
  }
  return (
    <fieldset
      className="grid gap-3 rounded-md border border-border p-3"
      data-slot="unverified-momo"
    >
      <legend className="px-1 font-semibold">
        <Smartphone aria-hidden="true" className="me-1 inline size-icon-md" />
        {t('unverified.title')}
      </legend>
      <p className="text-sm">{t('unverified.body')}</p>
      <Field label={t('unverified.amount')}>
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      <Field label={t('unverified.phone')} hint={t('momo.phoneHint')}>
        <Input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label={t('momo.network')}>
        <Select
          value={network}
          onValueChange={(value) => setNetwork(value as (typeof NETWORKS)[number])}
          options={NETWORKS.map((value) => ({ value, label: t(`momo.networks.${value}`) }))}
        />
      </Field>
      <Field label={t('unverified.reference')}>
        <Input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          autoComplete="off"
        />
      </Field>
      {ready ? (
        <PinApprovalField
          key={round}
          approval="OFFLINE_MOBILE_MONEY"
          approvers={approvers(localAuth.verifiers, 'OFFLINE_MOBILE_MONEY')}
          policy={localAuth.policy}
          label={t('unverified.approver')}
          onApproved={(record) => {
            if (amount === null) return;
            const providerReference = reference.trim();
            onTaken({
              key: newRecordId(),
              method,
              paymentMethodId: method.id,
              amountPesewas: amount,
              unverifiedMobileMoney: {
                payerPhone: payer,
                network,
                ...(providerReference !== '' ? { providerReference } : {}),
                approvedById: record.principalId,
              },
              label: t('unverified.taken', { name: method.name, approver: record.displayName }),
              approval: record,
            });
            setAmount(null);
            setPhone('');
            setReference('');
            setRound((n) => n + 1);
          }}
        />
      ) : null}
    </fieldset>
  );
}
