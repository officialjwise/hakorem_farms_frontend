'use client';

import { ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  MoneyDisplay,
  Skeleton,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../../lib/browserApi';
import { rememberCart, rememberCheckout, useCheckoutId } from '../../lib/cartId';
import { fill, refusal, word, type Words } from '../../lib/words';
import { CartLines } from '../cart/CartLines';
import { useCart } from '../cart/useCart';
import {
  checkDetails,
  EMPTY_DETAILS,
  fieldOf,
  toCheckoutStart,
  toCheckoutUpdate,
  type Details,
  type DetailsErrors,
} from './details';
import { DetailsForm } from './DetailsForm';
import { ShopData } from '../ShopData';
import { Done } from './Done';
import { Review } from './Review';
import { referenceCopy, RequestReference } from '../RequestReference';

type S = components['schemas'];

/**
 * The checkout (FR-SHP-005 to FR-SHP-009), on one page that works on a phone over 3G:
 *
 * 1. the basket, which can still change, with a coupon;
 * 2. the customer's details, delivery or collection, the address checked against the delivery zones, a
 *    delivery time from the zone's open slots, and how they will pay;
 * 3. "Hold my items": `startCheckout` reserves every line for 15 minutes and answers the total, which is
 *    checked and paid with `placeOrder`.
 *
 * Every figure is the API's. Each write carries one idempotency key per intent, so a retry on a weak
 * connection cannot reserve or charge twice. A failure stays on screen in words, with its reference.
 */
function Flow({ words }: { words: Words }) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const { id: cartId, query: cart } = useCart();
  const checkoutId = useCheckoutId();
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [quote, setQuote] = useState<S['DeliveryQuote'] | null>(null);
  const [editing, setEditing] = useState(false);
  const [placed, setPlaced] = useState<S['PlaceOrderResult'] | null>(null);
  const start = useApiMutation('startCheckout');
  const update = useApiMutation('updateCheckout');
  const open = useApiQuery(
    'getCheckout',
    { path: { id: checkoutId ?? '' } },
    { enabled: checkoutId !== null },
  );
  const intent = useRef<{ said: string; key: string } | null>(null);
  const keyFor = (said: string) => {
    if (intent.current?.said !== said) intent.current = { said, key: newIdempotencyKey() };
    return intent.current.key;
  };

  if (placed !== null) return <Done result={placed} words={words} />;

  // The open checkout, if there is one and it is still this cart's.
  const checkout =
    open.data !== undefined && open.data.cartId === cartId
      ? open.data
      : (update.data ?? start.data);
  const reviewing = checkout !== undefined && checkout.cartId === cartId && !editing;

  if (cartId === null) return <EmptyBasket words={words} />;
  if (cart.isPending) return <Skeleton label={w('loading')} shape="block" className="h-64" />;
  if (cart.isError) {
    if (cart.error.status === 404) return <EmptyBasket words={words} />;
    const retry = <Button onClick={() => void cart.refetch()}>{word(words, 'cart.retry')}</Button>;
    return cart.error.correlationId === '' ? (
      <ErrorState
        title={word(words, 'cart.errorTitle')}
        description={refusal(words, cart.error)}
        action={retry}
      />
    ) : (
      <ErrorState
        title={word(words, 'cart.errorTitle')}
        description={refusal(words, cart.error)}
        reference={cart.error.correlationId}
        referenceLabel={word(words, 'cart.reference')}
        referenceCopy={referenceCopy(words)}
        action={retry}
      />
    );
  }
  if (cart.data.lines.length === 0) return <EmptyBasket words={words} />;

  const hasWeighed = cart.data.lines.some((line) => line.catchWeight);
  const slotsOpen = quote?.deliverable === true;
  const hold = async () => {
    const found = checkDetails(details, words, false);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      if (checkout !== undefined && checkout.status === 'STARTED' && editing) {
        const body = toCheckoutUpdate(details);
        await update.mutateAsync(
          { path: { id: checkout.id }, body },
          { idempotencyKey: keyFor(JSON.stringify(['update', checkout.id, body])) },
        );
      } else {
        const body = toCheckoutStart(details);
        const started = await start.mutateAsync(
          { path: { id: cartId }, body },
          { idempotencyKey: keyFor(JSON.stringify(['start', cartId, body, checkout?.id ?? null])) },
        );
        rememberCheckout(started.id);
      }
      setEditing(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CHECKOUT_INVALID') {
        const named: DetailsErrors = {};
        for (const detail of error.details) {
          const field = fieldOf(detail.field);
          if (field !== null) named[field] = detail.message;
        }
        setErrors(named);
      }
    }
  };
  const failure = start.error ?? update.error;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="grid gap-8">
        <section aria-labelledby="basket-title" className="grid gap-3">
          <h2 id="basket-title" className="text-xl font-bold">
            {w('basket.title')}
          </h2>
          {reviewing ? (
            <p className="text-fg-muted">
              {cart.data.lines.map((line) => line.product.name).join(', ')}
            </p>
          ) : (
            <>
              <CartLines cart={cart.data} words={words} />
              <p className="flex items-baseline justify-between gap-3 font-semibold">
                <span>{word(words, 'cart.subtotal')}</span>
                <MoneyDisplay pesewas={cart.data.estimatedSubtotalPesewas} strong />
              </p>
              <Coupon cart={cart.data} words={words} />
            </>
          )}
        </section>

        <section aria-labelledby="details-title" className="grid gap-4">
          <h2 id="details-title" className="text-xl font-bold">
            {w('details.title')}
          </h2>
          {reviewing ? (
            <p className="text-fg-muted">
              {checkout.contactName} · {checkout.contactPhone}
            </p>
          ) : (
            <>
              <DetailsForm
                details={details}
                onChange={setDetails}
                errors={errors}
                quote={quote}
                onQuote={setQuote}
                hasWeighed={hasWeighed}
                words={words}
                locked={editing && checkout !== undefined}
              />
              {Object.keys(errors).length > 0 ? (
                <Alert severity="critical" title={w('details.invalid')} />
              ) : null}
              {failure === null || failure.code === 'CHECKOUT_INVALID' ? null : (
                <Alert severity="critical" title={w('holdFailed')}>
                  <p>{refusal(words, failure)}</p>
                  {failure.details.length === 0 ? null : (
                    <ul className="list-disc ps-5">
                      {failure.details.map((detail, index) => (
                        <li key={`${detail.code}-${index}`}>{detail.message}</li>
                      ))}
                    </ul>
                  )}
                  {failure.correlationId === '' ? null : (
                    <p className="text-sm">
                      {word(words, 'cart.reference')}{' '}
                      <RequestReference value={failure.correlationId} words={words} />
                    </p>
                  )}
                </Alert>
              )}
              <div>
                <Button
                  size="lg"
                  onClick={() => void hold()}
                  loading={start.isPending || update.isPending}
                  loadingLabel={w('holding')}
                  disabled={details.fulfilment === 'DELIVERY' && !slotsOpen && quote !== null}
                >
                  {w('hold')}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <section
        aria-labelledby="review-title"
        className="grid gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-4"
      >
        <h2 id="review-title" className="text-xl font-bold">
          {w('review.title')}
        </h2>
        {reviewing ? (
          <Review
            checkout={checkout}
            pay={details.pay}
            words={words}
            onChange={() => setEditing(true)}
            holdingAgain={start.isPending}
            onHoldAgain={() => {
              setEditing(false);
              void hold();
            }}
            onPlaced={(result) => {
              rememberCart(null);
              rememberCheckout(null);
              setPlaced(result);
            }}
          />
        ) : (
          <p className="text-fg-muted">{fill(w('hold'), {})}.</p>
        )}
      </section>
    </div>
  );
}

export function CheckoutFlow({ words }: { words: Words }) {
  return (
    <ShopData>
      <Flow words={words} />
    </ShopData>
  );
}

function EmptyBasket({ words }: { words: Words }) {
  return (
    <EmptyState
      icon={ShoppingBasket}
      title={word(words, 'checkout.empty.title')}
      description={word(words, 'checkout.empty.body')}
      action={
        <Button asChild>
          <Link href="/">{word(words, 'checkout.back')}</Link>
        </Button>
      }
    />
  );
}

/** One coupon on the cart (FR-SHP-004): applied by the API, its discount shown at checkout. */
function Coupon({ cart, words }: { cart: S['Cart']; words: Words }) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const [code, setCode] = useState('');
  const apply = useApiMutation('applyCartCoupon');
  const remove = useApiMutation('removeCartCoupon');
  if (cart.couponCode !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-good-fg">{fill(w('basket.couponApplied'), { code: cart.couponCode })}</p>
        <Button
          variant="ghost"
          size="sm"
          loading={remove.isPending}
          loadingLabel={w('basket.removeCoupon')}
          onClick={() => remove.mutate({ path: { id: cart.id } })}
        >
          {fill(w('basket.removeCoupon'), { code: cart.couponCode })}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim() === '') return;
        apply.mutate({ path: { id: cart.id }, body: { code: code.trim() } });
      }}
    >
      <Field
        label={w('basket.coupon')}
        error={
          apply.error === null ? '' : `${w('basket.couponFailed')}. ${refusal(words, apply.error)}`
        }
        className="min-w-0 flex-1"
      >
        <Input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={apply.isPending}
        loadingLabel={w('basket.applyCoupon')}
      >
        {w('basket.applyCoupon')}
      </Button>
    </form>
  );
}
