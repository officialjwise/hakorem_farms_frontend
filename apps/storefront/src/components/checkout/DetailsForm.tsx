'use client';

import { MapPin } from 'lucide-react';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Field,
  FieldGroup,
  Input,
  MoneyDisplay,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Textarea,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../../lib/browserApi';
import { counted, fill, refusal, word, wordList, type Words } from '../../lib/words';
import { slotDay, toAddress, type Details, type DetailsErrors, type PayMethod } from './details';

type Quote = components['schemas']['DeliveryQuote'];

/**
 * The customer's details: contact, delivery or collection, the address and a check that we deliver there,
 * the delivery time from the API's open slots, and how they will pay. Every check here is repeated by the
 * server; this only says what is missing before a slow round trip.
 */
export function DetailsForm({
  details,
  onChange,
  errors,
  quote,
  onQuote,
  hasWeighed,
  words,
  locked,
}: {
  details: Details;
  onChange: (next: Details) => void;
  errors: DetailsErrors;
  quote: Quote | null;
  onQuote: (quote: Quote | null) => void;
  /** Some line is weighed: ask what to do with a difference. */
  hasWeighed: boolean;
  words: Words;
  /** A checkout is open: the contact cannot change (CheckoutUpdate does not take it). */
  locked: boolean;
}) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const set = <K extends keyof Details>(key: K, value: Details[K]) => {
    const next = { ...details, [key]: value };
    // A changed address must be checked again before its zone's slots are offered.
    if (['line1', 'area', 'city', 'region'].includes(key)) {
      next.slotId = null;
      onQuote(null);
    }
    if (key === 'fulfilment' && value === 'COLLECTION' && details.pay === 'COD')
      next.pay = 'MOBILE_MONEY';
    onChange(next);
  };
  const required = { required: true as const, requiredLabel: w('details.required') };
  const text = (
    key: keyof Details,
    label: string,
    extra: { hint?: string; optional?: boolean; autoComplete?: string; type?: 'text' | 'tel' } = {},
  ) => {
    const control = (
      <Input
        type={extra.type ?? 'text'}
        value={String(details[key] ?? '')}
        autoComplete={extra.autoComplete}
        onChange={(event) => set(key, event.target.value as never)}
      />
    );
    return extra.optional ? (
      <Field label={label} hint={extra.hint} error={errors[key] ?? ''}>
        {control}
      </Field>
    ) : (
      <Field label={label} hint={extra.hint} error={errors[key] ?? ''} {...required}>
        {control}
      </Field>
    );
  };
  const delivery = details.fulfilment === 'DELIVERY';
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {locked ? (
          <p className="text-fg-muted sm:col-span-2">
            {details.name} · {details.phone}
          </p>
        ) : (
          <>
            {text('name', w('details.name'), { autoComplete: 'name' })}
            {text('phone', w('details.phone'), {
              hint: w('details.phoneHint'),
              autoComplete: 'tel',
              type: 'tel',
            })}
          </>
        )}
      </div>

      <RadioGroup
        asChild
        value={details.fulfilment}
        onValueChange={(value) => set('fulfilment', value as Details['fulfilment'])}
      >
        <FieldGroup label={w('details.fulfilment')}>
          <Radio value="DELIVERY" label={w('details.delivery')} hint={w('details.deliveryHint')} />
          <Radio
            value="COLLECTION"
            label={w('details.collection')}
            hint={w('details.collectionHint')}
          />
        </FieldGroup>
      </RadioGroup>

      {delivery ? (
        <fieldset className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <legend className="px-1 text-lg font-semibold">{w('address.title')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('line1', w('address.line1'), { autoComplete: 'address-line1' })}
            {text('area', w('address.area'), { hint: w('address.areaHint') })}
            {text('city', w('address.city'), { autoComplete: 'address-level2' })}
            <Field label={w('address.region')} error={errors.region ?? ''} {...required}>
              <Select
                value={details.region}
                onValueChange={(value) => set('region', value)}
                options={wordList(words, 'checkout.address.regions').map((region) => ({
                  value: region,
                  label: region,
                }))}
              />
            </Field>
            {text('digitalAddress', w('address.digitalAddress'), {
              hint: w('address.digitalAddressHint'),
              optional: true,
            })}
            {text('recipientName', w('address.recipient'), { optional: true })}
            {text('recipientPhone', w('address.recipientPhone'), { optional: true, type: 'tel' })}
            <Field label={w('address.directions')} error="">
              <Textarea
                rows={2}
                value={details.directions}
                onChange={(event) => set('directions', event.target.value)}
              />
            </Field>
          </div>
          <DeliveryCheck
            details={details}
            quote={quote}
            onQuote={onQuote}
            words={words}
            onCollect={() => set('fulfilment', 'COLLECTION')}
          />
          {quote?.deliverable && quote.zone !== null ? (
            <Slots
              zoneId={quote.zone.id}
              value={details.slotId}
              onValueChange={(slotId) => set('slotId', slotId)}
              error={errors.slotId}
              words={words}
            />
          ) : null}
        </fieldset>
      ) : null}

      <RadioGroup
        asChild
        value={details.pay}
        onValueChange={(value) => set('pay', value as PayMethod)}
      >
        <FieldGroup
          label={w('payment.title')}
          hint={delivery ? undefined : w('payment.codNeedsDelivery')}
        >
          <Radio
            value="MOBILE_MONEY"
            label={w('payment.mobileMoney')}
            hint={w('payment.mobileMoneyHint')}
          />
          <Radio value="CARD" label={w('payment.card')} hint={w('payment.cardHint')} />
          <Radio
            value="COD"
            label={w('payment.cod')}
            hint={w('payment.codHint')}
            disabled={!delivery}
          />
        </FieldGroup>
      </RadioGroup>

      {hasWeighed ? (
        <RadioGroup
          asChild
          value={details.difference}
          onValueChange={(value) => set('difference', value as Details['difference'])}
        >
          <FieldGroup label={w('payment.difference')}>
            <Radio value="REFUND" label={w('payment.refund')} />
            <Radio value="STORE_CREDIT" label={w('payment.storeCredit')} />
          </FieldGroup>
        </RadioGroup>
      ) : null}
    </div>
  );
}

/** "Check delivery to this address": the API's zone and its exact fee, or that we do not deliver there. */
function DeliveryCheck({
  details,
  quote,
  onQuote,
  onCollect,
  words,
}: {
  details: Details;
  quote: Quote | null;
  onQuote: (quote: Quote | null) => void;
  onCollect: () => void;
  words: Words;
}) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const check = useApiMutation('quoteDelivery');
  const address = toAddress(details);
  return (
    <div className="grid gap-3">
      {quote === null ? (
        <div>
          <Button
            variant="secondary"
            disabled={address === null}
            loading={check.isPending}
            loadingLabel={w('address.checking')}
            onClick={() => {
              if (address === null) return;
              void check
                .mutateAsync({ body: { address } })
                .then(onQuote)
                .catch(() => undefined);
            }}
          >
            <MapPin aria-hidden="true" />
            {w('address.check')}
          </Button>
        </div>
      ) : quote.deliverable && quote.zone !== null ? (
        <Alert severity="good" title={fill(w('address.deliverable'), { zone: quote.zone.name })}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3">
            <dt>{w('address.fee')}</dt>
            <dd>
              <MoneyDisplay pesewas={quote.feePesewas} notApplicableLabel={w('review.free')} />
            </dd>
            {quote.freeOverPesewas === null ? null : (
              <>
                <dt>{w('address.freeOver')}</dt>
                <dd>
                  <MoneyDisplay pesewas={quote.freeOverPesewas} />
                </dd>
              </>
            )}
          </dl>
          {quote.cutoffTime === null ? null : (
            <p>{fill(w('address.cutoff'), { time: quote.cutoffTime })}</p>
          )}
        </Alert>
      ) : (
        <Alert
          severity="warning"
          title={w('address.notDeliverable')}
          actions={
            <Button variant="secondary" onClick={onCollect}>
              {w('address.useCollection')}
            </Button>
          }
        />
      )}
      {check.error === null ? null : (
        <p role="alert" className="font-medium text-critical-fg">
          {w('address.checkFailed')}. {refusal(words, check.error)}
        </p>
      )}
    </div>
  );
}

/** The zone's delivery times that have not started, from the API, grouped by day. A full one says so. */
function Slots({
  zoneId,
  value,
  onValueChange,
  error,
  words,
}: {
  zoneId: string;
  value: string | null;
  onValueChange: (slotId: string) => void;
  error: string | undefined;
  words: Words;
}) {
  const w = (path: string) => word(words, `checkout.${path}`);
  // Open times change as people book; the list is read when the zone is known and kept 30 s.
  const slots = useApiQuery(
    'listDeliverySlotOptions',
    { query: { zoneId, limit: 50 } },
    { staleClass: 'working' },
  );
  if (slots.isPending)
    return <Skeleton label={w('slots.loading')} shape="block" className="h-32" />;
  if (slots.isError) {
    return (
      <p role="alert" className="font-medium text-critical-fg">
        {w('slots.errorTitle')}. {refusal(words, slots.error)}
      </p>
    );
  }
  if (slots.data.data.length === 0) return <Alert severity="info" title={w('slots.none')} />;
  return (
    <RadioGroup asChild value={value ?? ''} onValueChange={onValueChange}>
      <FieldGroup
        label={w('slots.title')}
        error={error ?? ''}
        required
        requiredLabel={w('details.required')}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.data.data.map((slot) => (
            <Radio
              key={slot.id}
              value={slot.id}
              disabled={!slot.available}
              label={fill(w('slots.slot'), {
                date: slotDay(slot.date, words),
                from: slot.startsAt,
                to: slot.endsAt,
              })}
              hint={
                slot.available
                  ? counted(words, 'checkout.slots.left', slot.remaining)
                  : w('slots.full')
              }
            />
          ))}
        </div>
      </FieldGroup>
    </RadioGroup>
  );
}
