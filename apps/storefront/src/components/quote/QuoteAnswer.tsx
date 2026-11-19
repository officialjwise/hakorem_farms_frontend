'use client';

import { CircleCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey, type ApiError, type components } from '@hakorem/api-client';
import { Alert, Button, Field, Input, formatMoney } from '@hakorem/ui';
import { useApiMutation } from '../../lib/browserApi';
import { refusal, word, type Words } from '../../lib/words';
import { RequestReference } from '../RequestReference';
import { ShopData } from '../ShopData';
import type { Confirming } from './QuoteConfirm';

/**
 * The confirmations' code (Radix Dialog with its focus trap and layers, and `Textarea`) loads once the
 * customer starts to answer, on the first focus on the name or a button or on the tap itself, not with
 * the page: a customer who only reads the quote does not download it (as the basket's drawer, ADR 0041).
 */
const QuoteConfirm = dynamic(() => import('./QuoteConfirm').then((m) => m.QuoteConfirm), {
  ssr: false,
});

type S = components['schemas'];

interface Props {
  /** The token from the link, sent back as it came, and nothing else that names the quote. */
  token: string;
  quote: Pick<S['PublicQuote'], 'quoteNo' | 'versionNo' | 'status' | 'grossPesewas'>;
  words: Words;
}

function Refused({ error, words }: { error: ApiError; words: Words }) {
  const w = (path: string) => word(words, `quote.${path}`);
  return (
    <Alert severity="critical" title={w('refusedTitle')}>
      <p>{refusal(words, error)}</p>
      <p>{w('refusedBody')}</p>
      {error.correlationId === '' ? null : (
        <p className="flex flex-wrap items-center gap-2">
          {word(words, 'cart.reference')}
          <RequestReference value={error.correlationId} words={words} />
        </p>
      )}
    </Alert>
  );
}

/**
 * Accepting or declining a quote from its link (FR-QUO-003), on a phone. The customer types their name in
 * place of a signature, and a confirmation repeats the quote, its version and the API's total before
 * anything is sent. The answer stays on the page. A refusal (the version expired or was replaced while
 * the page was open) stays too, in words, and the page reads the quote again so its state shows above;
 * this island keeps its place in the page, so the words survive that read.
 */
function Answer({ token, quote, words }: Props) {
  const w = (path: string) => word(words, `quote.${path}`);
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpenState] = useState<Confirming>(null);
  const [started, setStarted] = useState(false);
  /** The customer has started to answer: fetch the confirmations' code now, so it is there at the tap. */
  const start = () => setStarted(true);
  const setOpen = (next: Confirming) => {
    if (next !== null) setStarted(true);
    setOpenState(next);
  };
  const accept = useApiMutation('acceptQuoteByLink');
  const decline = useApiMutation('declineQuoteByLink');
  const intent = useRef<{ said: string; key: string } | null>(null);
  const keyFor = (said: string) => {
    if (intent.current?.said !== said) intent.current = { said, key: newIdempotencyKey() };
    return intent.current.key;
  };
  const decided = accept.data ?? decline.data;
  const failure = accept.error ?? decline.error;

  if (decided !== undefined) {
    return (
      <section aria-labelledby="quote-decided" className="grid gap-3">
        <h2 id="quote-decided" className="flex items-start gap-2 text-2xl font-bold text-balance">
          <CircleCheck aria-hidden="true" className="mt-1 size-icon-lg shrink-0 stroke-good" />
          {decided.status === 'ACCEPTED' ? w('acceptedTitle') : w('declinedTitle')}
        </h2>
        <Alert severity="good" title={decided.message} />
      </section>
    );
  }

  const refused = () => {
    setOpen(null);
    router.refresh();
  };
  const askAccept = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') {
      setNameError(w('acceptedNameMissing'));
      return;
    }
    setNameError('');
    accept.reset();
    setOpen('accept');
  };
  const total = formatMoney(quote.grossPesewas);
  return (
    <div className="grid gap-4">
      {failure === null ? null : <Refused error={failure} words={words} />}
      {quote.status !== 'ISSUED' ? null : (
        <section
          aria-labelledby="quote-answer"
          className="grid gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <div className="grid gap-1">
            <h2 id="quote-answer" className="text-xl font-bold">
              {w('issued.title')}
            </h2>
            <p className="text-fg-muted">{w('issued.body')}</p>
          </div>
          <form className="grid gap-4" onSubmit={askAccept} noValidate>
            <Field
              label={w('acceptedName')}
              hint={w('acceptedNameHint')}
              error={nameError}
              required
              requiredLabel={word(words, 'quoteRequest.required')}
            >
              <Input
                value={name}
                autoComplete="name"
                onFocus={start}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" onFocus={start}>
                {w('accept')}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onFocus={start}
                onClick={() => {
                  decline.reset();
                  setOpen('decline');
                }}
              >
                {w('decline')}
              </Button>
            </div>
          </form>
        </section>
      )}
      {started ? (
        <QuoteConfirm
          open={open}
          onOpen={setOpen}
          quoteNo={quote.quoteNo}
          versionNo={quote.versionNo}
          total={total}
          name={name.trim()}
          reason={reason}
          onReason={setReason}
          accepting={accept.isPending}
          declining={decline.isPending}
          onAccept={() => {
            const body = { acceptedName: name.trim() };
            accept
              .mutateAsync(
                { path: { token }, body },
                { idempotencyKey: keyFor(JSON.stringify(['accept', body])) },
              )
              .then(() => setOpen(null))
              .catch(refused);
          }}
          onDecline={() => {
            const said = reason.trim();
            const body = said === '' ? {} : { reason: said };
            decline
              .mutateAsync(
                { path: { token }, body },
                { idempotencyKey: keyFor(JSON.stringify(['decline', body])) },
              )
              .then(() => setOpen(null))
              .catch(refused);
          }}
          words={words}
        />
      ) : null}
    </div>
  );
}

/** The answer with the storefront's one QueryClient (ADR 0041). */
export function QuoteAnswer(props: Props) {
  return (
    <ShopData>
      <Answer {...props} />
    </ShopData>
  );
}
