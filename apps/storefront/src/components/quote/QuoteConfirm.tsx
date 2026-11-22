'use client';

import { CircleCheck, X } from 'lucide-react';
import type { components } from '@hakorem/api-client';
import { Button, Dialog, DialogActions, Field, Textarea } from '@hakorem/ui';
import { fill, word, type Words } from '../../lib/words';

export type Confirming = 'accept' | 'decline' | null;

export interface QuoteConfirmProps {
  open: Confirming;
  onOpen: (open: Confirming) => void;
  quoteNo: components['schemas']['PublicQuote']['quoteNo'];
  versionNo: components['schemas']['PublicQuote']['versionNo'];
  /** The API's total, formatted. */
  total: string;
  /** The name the customer typed, trimmed. */
  name: string;
  reason: string;
  onReason: (reason: string) => void;
  accepting: boolean;
  declining: boolean;
  onAccept: () => void;
  onDecline: () => void;
  words: Words;
}

/**
 * The two confirmations of an answer from a quote's link: accepting repeats the quote, its version, the
 * API's total and the name typed; declining takes an optional reason. They are a module of their own so
 * the dialog's code (Radix Dialog, its focus trap and layers, `Textarea`) loads when the customer starts to
 * answer, not with the page (`QuoteAnswer`). Radix returns focus to the button that opened them.
 */
export function QuoteConfirm({
  open,
  onOpen,
  quoteNo,
  versionNo,
  total,
  name,
  reason,
  onReason,
  accepting,
  declining,
  onAccept,
  onDecline,
  words,
}: QuoteConfirmProps) {
  const w = (path: string) => word(words, `quote.${path}`);
  return (
    <>
      <Dialog
        open={open === 'accept'}
        onOpenChange={(next) => onOpen(next ? 'accept' : null)}
        title={fill(w('confirmAccept.title'), { quoteNo })}
        closeLabel={w('close')}
      >
        <div className="grid gap-4">
          <p>{fill(w('confirmAccept.body'), { versionNo, total, name })}</p>
          <DialogActions cancelLabel={w('cancel')} onCancel={() => onOpen(null)}>
            <Button
              loading={accepting}
              loadingLabel={w('confirmAccept.sending')}
              onClick={onAccept}
            >
              <CircleCheck />
              {w('confirmAccept.confirm')}
            </Button>
          </DialogActions>
        </div>
      </Dialog>
      <Dialog
        open={open === 'decline'}
        onOpenChange={(next) => onOpen(next ? 'decline' : null)}
        title={fill(w('confirmDecline.title'), { quoteNo })}
        closeLabel={w('close')}
      >
        <div className="grid gap-4">
          <p>{fill(w('confirmDecline.body'), { versionNo })}</p>
          <Field label={w('confirmDecline.reason')} hint={w('confirmDecline.reasonHint')}>
            <Textarea value={reason} rows={3} onChange={(event) => onReason(event.target.value)} />
          </Field>
          <DialogActions cancelLabel={w('cancel')} onCancel={() => onOpen(null)}>
            <Button
              variant="danger"
              loading={declining}
              loadingLabel={w('confirmDecline.sending')}
              onClick={onDecline}
            >
              <X />
              {w('confirmDecline.confirm')}
            </Button>
          </DialogActions>
        </div>
      </Dialog>
    </>
  );
}
