'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import type { components } from '@hakorem/api-client';
import { Alert, Button } from '@hakorem/ui';
import { useApiQuery } from '../../lib/browserApi';
import { fill, refusal, word, type Words } from '../../lib/words';

type Result = components['schemas']['PlaceOrderResult'];

/**
 * The order is placed (FR-SHP-007). It is confirmed by the payment provider's verified callback, not by
 * this page (placeOrder's description), so the page shows what the API said to do and lets the customer
 * check again; cash on delivery is confirmed at once.
 */
export function Done({ result, words }: { result: Result; words: Words }) {
  const w = (path: string) => word(words, `checkout.${path}`);
  const checkout = useApiQuery(
    'getCheckout',
    { path: { id: result.checkout.id } },
    { enabled: false },
  );
  const status = checkout.data?.status ?? result.checkout.status;
  const paid = status === 'COMPLETED';
  const payment = result.payment;
  return (
    <section aria-labelledby="done-title" className="grid gap-4">
      <h2 id="done-title" className="flex items-start gap-2 text-2xl font-bold text-balance">
        <CircleCheck aria-hidden="true" className="mt-1 size-icon-lg shrink-0 stroke-good" />
        {fill(w('done.title'), { orderNo: result.orderNo })}
      </h2>
      {paid || payment === null ? (
        <Alert severity="good" title={paid ? w('done.paid') : w('done.confirmed')} />
      ) : (
        <Alert
          severity="info"
          title={w('done.awaitingPayment')}
          actions={
            <Button
              variant="secondary"
              onClick={() => void checkout.refetch()}
              loading={checkout.isFetching}
              loadingLabel={w('done.checking')}
            >
              {w('done.check')}
            </Button>
          }
        >
          {payment.instructions === null ? null : (
            <p>
              <strong>{w('done.instructions')}:</strong> {payment.instructions}
            </p>
          )}
          {payment.redirectUrl === null ? null : (
            <p>
              <a href={payment.redirectUrl} className="text-accent-text underline">
                {w('done.card')}
              </a>
            </p>
          )}
          {checkout.error === null ? null : (
            <p role="alert" className="font-medium text-critical-fg">
              {refusal(words, checkout.error)}
            </p>
          )}
        </Alert>
      )}
      <p>{fill(w('done.keep'), { orderNo: result.orderNo })}</p>
      <div>
        <Button asChild variant="secondary">
          <Link href="/">{w('done.continue')}</Link>
        </Button>
      </div>
    </section>
  );
}
