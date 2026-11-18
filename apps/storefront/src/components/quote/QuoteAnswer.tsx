'use client';

import { CircleCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey, type ApiError, type components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  Field,
  Input,
  Textarea,
  formatMoney,
} from '@hakorem/ui';
import { useApiMutation } from '../../lib/browserApi';
import { fill, refusal, word, type Words } from '../../lib/words';
import { RequestReference } from '../RequestReference';
import { ShopData } from '../ShopData';

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
  const [open, setOpen] = useState<'accept' | 'decline' | null>(null);
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
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg">
                {w('accept')}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
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
      <Dialog
        open={open === 'accept'}
        onOpenChange={(next) => setOpen(next ? 'accept' : null)}
        title={fill(w('confirmAccept.title'), { quoteNo: quote.quoteNo })}
        closeLabel={w('close')}
      >
        <div className="grid gap-4">
          <p>
            {fill(w('confirmAccept.body'), {
              versionNo: quote.versionNo,
              total,
              name: name.trim(),
            })}
          </p>
          <DialogActions cancelLabel={w('cancel')} onCancel={() => setOpen(null)}>
            <Button
              loading={accept.isPending}
              loadingLabel={w('confirmAccept.sending')}
              onClick={() => {
                const body = { acceptedName: name.trim() };
                accept
                  .mutateAsync(
                    { path: { token }, body },
                    { idempotencyKey: keyFor(JSON.stringify(['accept', body])) },
                  )
                  .then(() => setOpen(null))
                  .catch(refused);
              }}
            >
              <CircleCheck />
              {w('confirmAccept.confirm')}
            </Button>
          </DialogActions>
        </div>
      </Dialog>
      <Dialog
        open={open === 'decline'}
        onOpenChange={(next) => setOpen(next ? 'decline' : null)}
        title={fill(w('confirmDecline.title'), { quoteNo: quote.quoteNo })}
        closeLabel={w('close')}
      >
        <div className="grid gap-4">
          <p>{fill(w('confirmDecline.body'), { versionNo: quote.versionNo })}</p>
          <Field label={w('confirmDecline.reason')} hint={w('confirmDecline.reasonHint')}>
            <Textarea value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <DialogActions cancelLabel={w('cancel')} onCancel={() => setOpen(null)}>
            <Button
              variant="danger"
              loading={decline.isPending}
              loadingLabel={w('confirmDecline.sending')}
              onClick={() => {
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
            >
              <X />
              {w('confirmDecline.confirm')}
            </Button>
          </DialogActions>
        </div>
      </Dialog>
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
