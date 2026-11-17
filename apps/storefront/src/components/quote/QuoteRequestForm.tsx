'use client';

import { CircleCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey, type components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Field,
  Input,
  NumberInput,
  Textarea,
} from '@hakorem/ui';
import { useApiMutation } from '../../lib/browserApi';
import { fill, refusal, word, type Words } from '../../lib/words';
import { RequestReference } from '../RequestReference';
import { ShopData } from '../ShopData';
import {
  EMPTY_REQUEST,
  REQUIREMENTS_MAX,
  accraToday,
  checkRequest,
  toQuoteRequest,
  type RequestDraft,
  type RequestErrors,
} from './quoteRequest';

type Received = components['schemas']['QuoteRequestReceived'];

/**
 * The public request for a quote (FR-QUO-001): who is asking, what they want and how many crates. No
 * captcha and no hidden trap field: abuse is the server's to stop, by address and by phone number (the
 * operation's description), and a refusal for too many requests is said in words with its reference.
 * One idempotency key per request as typed, so a retry on a weak connection is answered once.
 */
function Form({ words }: { words: Words }) {
  const w = (path: string) => word(words, `quoteRequest.${path}`);
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_REQUEST);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [received, setReceived] = useState<Received | null>(null);
  const submit = useApiMutation('submitQuoteRequest');
  const intent = useRef<{ said: string; key: string } | null>(null);
  const keyFor = (said: string) => {
    if (intent.current?.said !== said) intent.current = { said, key: newIdempotencyKey() };
    return intent.current.key;
  };
  const set = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) =>
    setDraft((now) => ({ ...now, [key]: value }));

  if (received !== null) {
    return (
      <section aria-labelledby="request-done" className="grid gap-4">
        <h2 id="request-done" className="flex items-start gap-2 text-2xl font-bold text-balance">
          <CircleCheck aria-hidden="true" className="mt-1 size-icon-lg shrink-0 stroke-good" />
          {fill(w('doneTitle'), { rfqNo: received.rfqNo })}
        </h2>
        <Alert severity="good" title={received.message}>
          {w('doneBody')}
        </Alert>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setReceived(null);
              setDraft(EMPTY_REQUEST);
              submit.reset();
            }}
          >
            {w('another')}
          </Button>
        </div>
      </section>
    );
  }

  const send = (event: FormEvent) => {
    event.preventDefault();
    const found = checkRequest(draft, words, accraToday());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = toQuoteRequest(draft, words);
    submit
      .mutateAsync({ body }, { idempotencyKey: keyFor(JSON.stringify(body)) })
      .then(setReceived)
      .catch(() => undefined);
  };
  const required = { required: true as const, requiredLabel: w('required') };
  const failure = submit.error;
  return (
    <form className="grid gap-5" onSubmit={send} noValidate aria-describedby="request-intro">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={w('name')} error={errors.name ?? ''} {...required}>
          <Input
            value={draft.name}
            autoComplete="name"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label={w('phone')} hint={w('phoneHint')} error={errors.phone ?? ''} {...required}>
          <Input
            type="tel"
            value={draft.phone}
            autoComplete="tel"
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
      </div>
      <Field
        label={w('requirements')}
        hint={w('requirementsHint')}
        error={errors.requirements ?? ''}
        {...required}
      >
        <Textarea
          value={draft.requirements}
          rows={4}
          maxLength={REQUIREMENTS_MAX}
          onChange={(e) => set('requirements', e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={w('crates')} hint={w('cratesHint')} error={errors.crates ?? ''}>
          <NumberInput
            value={draft.crates}
            onValueChange={(value) => set('crates', value)}
            decimals={0}
          />
        </Field>
        <Field label={w('neededBy')} hint={w('neededByHint')} error={errors.neededBy ?? ''}>
          <DatePicker
            value={draft.neededBy}
            min={accraToday()}
            onChange={(e) => set('neededBy', e.target.value)}
          />
        </Field>
        <Field
          label={w('deliveryArea')}
          hint={w('deliveryAreaHint')}
          error={errors.deliveryArea ?? ''}
        >
          <Input
            value={draft.deliveryArea}
            autoComplete="address-level2"
            onChange={(e) => set('deliveryArea', e.target.value)}
          />
        </Field>
        <Field label={w('email')} hint={w('emailHint')} error={errors.email ?? ''}>
          <Input
            type="email"
            value={draft.email}
            autoComplete="email"
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
      </div>
      <Field
        label={w('consent')}
        hint={w('consentHint')}
        error={errors.consent ?? ''}
        {...required}
      >
        <Checkbox
          checked={draft.consent}
          onCheckedChange={(checked) => set('consent', checked === true)}
        />
      </Field>
      {Object.keys(errors).length > 0 ? (
        <Alert severity="critical" title={w('errors.title')} />
      ) : null}
      {failure === null ? null : (
        <Alert severity="critical" title={w('failed')}>
          <p>{failure.code === 'RATE_LIMITED' ? w('rateLimited') : refusal(words, failure)}</p>
          {failure.details.length === 0 ? null : (
            <ul className="list-disc ps-5">
              {failure.details.map((detail, index) => (
                <li key={`${detail.code}-${index}`}>{detail.message}</li>
              ))}
            </ul>
          )}
          {failure.correlationId === '' ? null : (
            <p className="flex flex-wrap items-center gap-2">
              {word(words, 'cart.reference')}
              <RequestReference value={failure.correlationId} words={words} />
            </p>
          )}
        </Alert>
      )}
      <div>
        <Button type="submit" size="lg" loading={submit.isPending} loadingLabel={w('sending')}>
          {w('submit')}
        </Button>
      </div>
    </form>
  );
}

/** The form with the storefront's one QueryClient (ADR 0041), so the data layer loads with it alone. */
export function QuoteRequestForm({ words }: { words: Words }) {
  return (
    <ShopData>
      <Form words={words} />
    </ShopData>
  );
}
