'use client';

import { Clock, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  CatchWeightNotice,
  Field,
  FieldGroup,
  formatDateTime,
  formatMoney,
  Input,
  MoneyDisplay,
  Radio,
  RadioGroup,
  WeightDisplay,
} from '@hakorem/ui';
import { useApiMutation } from '../../lib/browserApi';
import { cardPageNotOpened } from '../../lib/cardPage';
import { toE164 } from '../../lib/phone';
import { fill, refusal, word, type Words } from '../../lib/words';
import { perUnit } from '../cart/CartLines';
import { slotDay, type PayMethod } from './details';
import { RequestReference } from '../RequestReference';

type S = components['schemas'];
type Checkout = S['Checkout'];
type Network = NonNullable<S['PlaceOrderRequest']['network']>;
const NETWORKS: readonly Network[] = ['MTN', 'TELECEL', 'AIRTELTIGO'];

/**
 * Check and pay (FR-SHP-007): every line with the API's estimate, the delivery, the tax in it, and the
 * total. When anything is weighed, the total is said to be an estimate beside it, with the most that can
 * be charged and the API's rule in its words, so it cannot be missed. The pay button names the exact
 * amount: this step is the confirmation that a money write needs. Nothing here is summed.
 */
export function Review({
  checkout,
  pay,
  words,
  onChange,
  onHoldAgain,
  holdingAgain,
  onPlaced,
}: {
  checkout: Checkout;
  pay: PayMethod;
  words: Words;
  onChange: () => void;
  onHoldAgain: () => void;
  holdingAgain: boolean;
  onPlaced: (result: S['PlaceOrderResult']) => void;
}) {
  const w = (path: string) => word(words, `checkout.${path}`);
  // Set once a card order is placed without its page: the details can no longer change.
  const [placed, setPlaced] = useState(false);
  const weighed = checkout.lines.some((line) => line.catchWeight);
  const expired = checkout.status === 'EXPIRED' || checkout.status === 'CANCELLED';
  const held = formatDateTime(checkout.reservedUntil).slice(11);
  const address = checkout.deliveryAddress;
  return (
    <div className="grid gap-5">
      {checkout.priceChanged ? <Alert severity="warning" title={w('review.priceChanged')} /> : null}
      {expired ? (
        <Alert
          severity="warning"
          title={w('review.expired')}
          actions={
            <Button onClick={onHoldAgain} loading={holdingAgain} loadingLabel={w('holding')}>
              {w('review.holdAgain')}
            </Button>
          }
        />
      ) : (
        <p className="flex items-start gap-2 font-medium text-fg">
          <Clock aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 stroke-accent" />
          {fill(w('review.heldUntil'), { time: held })}
        </p>
      )}

      <section aria-labelledby="review-lines" className="grid gap-2">
        <h3 id="review-lines" className="font-semibold">
          {w('review.lines')}
        </h3>
        <ul className="grid divide-y divide-border rounded-lg border border-border bg-surface">
          {checkout.lines.map((line) => (
            <li key={line.cartLineId} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-0.5">
                <span className="font-medium">
                  {Number.parseInt(line.quantity, 10)} × {line.product.name}
                </span>
                <span className="text-sm text-fg-muted">
                  <MoneyDisplay pesewas={line.unitPricePesewas} /> {perUnit(words, line)}
                  {line.estimatedWeightKg === null ? null : (
                    <>
                      {' · '}
                      <WeightDisplay kilograms={line.estimatedWeightKg} />
                    </>
                  )}
                </span>
              </div>
              <div className="grid content-start text-start sm:text-end">
                <MoneyDisplay pesewas={line.estimatedLineTotalPesewas} strong />
                {line.catchWeight ? (
                  <span className="text-sm text-fg-muted">
                    {fill(w('review.lineMaximum'), {
                      price: formatMoney(line.maximumLineTotalPesewas),
                    })}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
          <li className="flex justify-between gap-3 p-3">
            <span>
              {checkout.fulfilmentMode === 'DELIVERY'
                ? w('review.delivery')
                : w('review.collection')}
            </span>
            {checkout.deliveryFeePesewas === 0 ? (
              <span>{w('review.free')}</span>
            ) : (
              <MoneyDisplay pesewas={checkout.deliveryFeePesewas} />
            )}
          </li>
          {checkout.promotions.map((promotion) => (
            <li key={promotion.promotionId} className="flex justify-between gap-3 p-3 text-good-fg">
              <span>{fill(w('review.discount'), { name: promotion.name })}</span>
              <span>
                − <MoneyDisplay pesewas={promotion.discountPesewas} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {weighed ? (
        <CatchWeightNotice
          title={w('review.weighedTitle')}
          facts={[
            {
              term: w('review.estimated'),
              value: (
                <MoneyDisplay pesewas={checkout.estimatedTotalPesewas} strong className="text-xl" />
              ),
            },
            {
              term: w('review.maximum'),
              value: <MoneyDisplay pesewas={checkout.maximumTotalPesewas} strong />,
            },
            { term: w('review.tax'), value: <MoneyDisplay pesewas={checkout.taxPesewas} /> },
          ]}
        >
          {checkout.finalChargeRule}
        </CatchWeightNotice>
      ) : (
        <section
          aria-label={w('review.fixedTitle')}
          className="grid gap-1 rounded-lg border-2 border-accent bg-surface p-4"
        >
          <p className="flex items-baseline justify-between gap-3 text-xl font-bold">
            <span>{w('review.fixedTitle')}</span>
            <MoneyDisplay pesewas={checkout.estimatedTotalPesewas} strong />
          </p>
          <p className="flex justify-between gap-3 text-fg-muted">
            <span>{w('review.tax')}</span>
            <MoneyDisplay pesewas={checkout.taxPesewas} />
          </p>
          <p className="text-pretty">{checkout.finalChargeRule}</p>
        </section>
      )}

      <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="text-fg-muted">{w('review.contact')}</dt>
        <dd>
          {checkout.contactName} · {checkout.contactPhone}
        </dd>
        {address === null ? null : (
          <>
            <dt className="text-fg-muted">{w('review.deliverTo')}</dt>
            <dd>
              {[address.line1, address.area, address.city, address.region].join(', ')}
              {checkout.deliveryZone === null ? null : (
                <span className="block text-sm text-fg-muted">{checkout.deliveryZone.name}</span>
              )}
            </dd>
          </>
        )}
        {checkout.deliverySlot === null ? null : (
          <>
            <dt className="text-fg-muted">{w('review.when')}</dt>
            <dd>
              {fill(w('slots.slot'), {
                date: slotDay(checkout.deliverySlot.date, words),
                from: checkout.deliverySlot.startsAt,
                to: checkout.deliverySlot.endsAt,
              })}
            </dd>
          </>
        )}
        <dd className="sm:col-span-2">
          <Button variant="secondary" size="sm" onClick={onChange} disabled={expired || placed}>
            {w('review.change')}
          </Button>
        </dd>
      </dl>

      {expired ? null : (
        <Pay
          checkout={checkout}
          pay={pay}
          words={words}
          onPlaced={onPlaced}
          onPlacedWithoutPage={() => setPlaced(true)}
        />
      )}
    </div>
  );
}

/**
 * The payment: mobile money with its number and network, card, or cash on delivery; then one button.
 *
 * Card (contract 2.30.0): the order is placed and the API answers the card provider's page, which `Done`
 * opens. When the page could not be opened, the order is placed all the same (503
 * `PAYMENT_PROVIDER_UNAVAILABLE`): that is said here, and stays, with one button that sends the same
 * request with the same idempotency key, which opens the page for that order and never places a second.
 */
function Pay({
  checkout,
  pay,
  words,
  onPlaced,
  onPlacedWithoutPage,
}: {
  checkout: Checkout;
  pay: PayMethod;
  words: Words;
  onPlaced: (result: S['PlaceOrderResult']) => void;
  onPlacedWithoutPage: () => void;
}) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const place = useApiMutation('placeOrder');
  const [payer, setPayer] = useState(checkout.contactPhone);
  const [network, setNetwork] = useState<Network>('MTN');
  const [checked, setChecked] = useState(false);
  // Kept once true: the order exists, even while a replay is on its way or is refused.
  const [withoutPage, setWithoutPage] = useState(false);
  const intent = useRef<{ said: string; key: string } | null>(null);
  const method = checkout.paymentTerms === 'COD' ? 'COD' : pay === 'COD' ? 'MOBILE_MONEY' : pay;
  const amount = formatMoney(checkout.estimatedTotalPesewas);
  const payerPhone = toE164(payer);
  const body: S['PlaceOrderRequest'] =
    method === 'MOBILE_MONEY'
      ? { paymentMethod: 'MOBILE_MONEY', payerPhone: payerPhone ?? payer, network }
      : { paymentMethod: method };
  const label =
    method === 'COD'
      ? fill(w('review.placeCod'), { amount })
      : method === 'CARD'
        ? fill(w('review.payCard'), { amount })
        : fill(w('review.pay'), { amount });
  const Icon = method === 'COD' ? Wallet : method === 'CARD' ? CreditCard : Smartphone;
  const submit = async () => {
    setChecked(true);
    if (method === 'MOBILE_MONEY' && payerPhone === null) return;
    // One key per payment asked for: a retry of the same one cannot charge twice.
    const said = JSON.stringify(body);
    if (intent.current?.said !== said) intent.current = { said, key: newIdempotencyKey() };
    try {
      const result = await place.mutateAsync(
        { path: { id: checkout.id }, body },
        { idempotencyKey: intent.current.key },
      );
      onPlaced(result);
    } catch (error) {
      // Said on screen from `place.error`.
      if (error instanceof ApiError && cardPageNotOpened(method, error)) {
        setWithoutPage(true);
        onPlacedWithoutPage();
      }
    }
  };
  const reference =
    place.error === null || place.error.correlationId === '' ? null : (
      <span className="block text-sm">
        {word(words, 'cart.reference')}{' '}
        <RequestReference value={place.error.correlationId} words={words} />
      </span>
    );
  if (withoutPage) {
    // The order is placed; only its card page is missing. No other way to pay is offered for it here.
    return (
      <section
        aria-labelledby="pay-title"
        className="grid gap-4 rounded-lg border border-border bg-surface p-4"
      >
        <h3 id="pay-title" className="text-lg font-semibold">
          {w('review.payTitle.CARD')}
        </h3>
        <Alert
          severity="warning"
          title={w('review.cardNotOpened.title')}
          actions={
            <Button
              // May wrap: at 360 px the label fills the alert's column, and a wider font would overflow it.
              className="h-auto min-h-control-md py-2 text-center whitespace-normal"
              onClick={() => void submit()}
              loading={place.isPending}
              loadingLabel={w('review.cardNotOpened.opening')}
            >
              <CreditCard aria-hidden="true" />
              {w('review.cardNotOpened.open')}
            </Button>
          }
        >
          <p>{w('review.cardNotOpened.body')}</p>
          {place.error === null || cardPageNotOpened(method, place.error) ? null : (
            <p className="font-medium">{refusal(words, place.error)}</p>
          )}
          {reference}
        </Alert>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="pay-title"
      className="grid gap-4 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id="pay-title" className="text-lg font-semibold">
        {w(`review.payTitle.${method}`)}
      </h3>
      {method === 'MOBILE_MONEY' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={w('review.payerPhone')}
            hint={w('review.payerPhoneHint')}
            error={checked && payerPhone === null ? w('details.phoneInvalid') : ''}
            required
            requiredLabel={w('details.required')}
          >
            <Input
              type="tel"
              autoComplete="tel"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
            />
          </Field>
          <RadioGroup
            asChild
            value={network}
            onValueChange={(value) => setNetwork(value as Network)}
          >
            <FieldGroup label={w('review.network')}>
              {NETWORKS.map((n) => (
                <Radio key={n} value={n} label={w(`review.networks.${n}`)} />
              ))}
            </FieldGroup>
          </RadioGroup>
        </div>
      ) : (
        <p className="text-fg-muted">
          {method === 'CARD' ? w('payment.cardHint') : w('payment.codHint')}
        </p>
      )}
      <div>
        <Button
          size="lg"
          fullWidth
          // May wrap: at 360 px "Pay GH₵12,450.00 by card" is wider than the column.
          className="h-auto min-h-control-lg py-2 text-center whitespace-normal sm:w-auto"
          onClick={() => void submit()}
          loading={place.isPending}
          loadingLabel={w('review.placing')}
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
      </div>
      {place.error === null ? null : (
        <Alert severity="critical" title={w('review.placeFailed')}>
          {refusal(words, place.error)}
          {reference}
        </Alert>
      )}
    </section>
  );
}
