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
import { cartTotal, lineAmount, splitTender, type CartLine } from '../offline/cart';
import { getTill } from '../offline/till';
import type { OfflinePack, SaleEntry } from '../offline/types';
import { tenderMethods } from './catalogue';

type PaymentMethodRef = components['schemas']['PaymentMethodRef'];
type Payment = components['schemas']['Payment'];

interface ClearedTender {
  method: PaymentMethodRef;
  paymentMethodId: string;
  amountPesewas: number;
  paymentId: string;
  reference: string;
}

/**
 * Taking payment (FR-POS split tender): cash, and, while online, mobile money the customer approves on
 * their phone, which counts only once the provider has cleared it (a verified payment, OFFLINE_SYNC 5.3).
 * Offline the till takes only the pack's offline methods: cash. Change comes from cash only. Then a
 * confirmation with every amount before anything is written (BUILD_PROMPT), and the sale is queued.
 */
export function PayDialog({
  lines,
  pack,
  online,
  onClose,
  onDone,
}: {
  lines: CartLine[];
  pack: OfflinePack;
  online: boolean;
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

  const split = splitTender(total, cleared, handed ?? 0);
  const canReview = cash !== null && !split.otherExceedsTotal && split.shortPesewas === 0;

  const complete = () => {
    if (cash === null) return;
    setSaving(true);
    setFailed(null);
    getTill()
      .completeSale({
        lines,
        cashMethod: cash,
        others: cleared.map(({ method, paymentMethodId, amountPesewas, paymentId }) => ({
          method,
          paymentMethodId,
          amountPesewas,
          paymentId,
        })),
        cashHandedPesewas: handed ?? 0,
        customerPhone: null,
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
              <p key={tender.paymentId} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t('pay.cleared', { name: tender.method.name, reference: tender.reference })}
                </span>
                <MoneyDisplay pesewas={tender.amountPesewas} />
              </p>
            ))}
            {momo !== null && auth.can('pay.payment.initiate') ? (
              <MobileMoney
                method={momo}
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
                <Row
                  key={tender.paymentId}
                  term={tender.method.name}
                  pesewas={tender.amountPesewas}
                />
              ))}
              {split.cashAppliedPesewas > 0 || cleared.length === 0 ? (
                <>
                  <Row term={t('pay.cash')} pesewas={split.cashAppliedPesewas} />
                  <Row term={t('pay.handed')} pesewas={handed ?? 0} />
                </>
              ) : null}
              <Row term={t('pay.changeDue')} pesewas={split.changePesewas} strong />
            </dl>
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
 * counts only when the provider has cleared it (`checkPaymentStatus`). A refusal stays here in words.
 */
function MobileMoney({
  method,
  remaining,
  onCleared,
}: {
  method: PaymentMethodRef;
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
        method,
        paymentMethodId: method.id,
        amountPesewas: answer.amountPesewas,
        paymentId: answer.id,
        reference: answer.paymentNo ?? answer.providerReference ?? answer.id,
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
          {error.correlationId !== ''
            ? ` ${t('referenceIs', { reference: error.correlationId })}`
            : ''}
        </Alert>
      ) : null}
    </fieldset>
  );
}
