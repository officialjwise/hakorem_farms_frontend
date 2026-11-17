'use client';

import { ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { Button, EmptyState, MoneyDisplay, QueryBoundary, Sheet } from '@hakorem/ui';
import { word, type Words } from '../../lib/words';
import { CartLines } from './CartLines';
import { useCart } from './useCart';
import { ShopData } from '../ShopData';
import { referenceCopy } from '../RequestReference';

/**
 * The basket drawer: its lines, the API's estimated subtotal and what it does not include, and the way on
 * to checkout. Its four states: loading, empty (no cart yet, or none of its lines), the error with its
 * reference and a retry, and the lines. A public cart has no permission to deny.
 */
function Drawer({
  open,
  onOpenChange,
  words,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  words: Words;
}) {
  const { id, query } = useCart();
  const close = () => onOpenChange(false);
  const hasLines = (query.data?.lines.length ?? 0) > 0;
  const labels = {
    loading: word(words, 'cart.loading'),
    emptyTitle: word(words, 'cart.emptyTitle'),
    emptyDescription: word(words, 'cart.emptyBody'),
    errorTitle: word(words, 'cart.errorTitle'),
    errorDescription: word(words, 'cart.errorBody'),
    retry: word(words, 'cart.retry'),
    reference: word(words, 'cart.reference'),
    referenceCopy: referenceCopy(words),
    deniedTitle: word(words, 'cart.errorTitle'),
  };
  return (
    <Sheet
      side="end"
      open={open}
      onOpenChange={onOpenChange}
      title={word(words, 'cart.title')}
      closeLabel={word(words, 'cart.close')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {word(words, 'cart.continue')}
          </Button>
          {hasLines ? (
            <Button asChild>
              <Link href="/checkout" onClick={close}>
                {word(words, 'cart.checkout')}
              </Link>
            </Button>
          ) : null}
        </>
      }
    >
      {id === null ? (
        <EmptyState
          compact
          icon={ShoppingBasket}
          title={labels.emptyTitle}
          description={labels.emptyDescription}
        />
      ) : (
        <QueryBoundary query={query} labels={labels} isEmpty={(cart) => cart.lines.length === 0}>
          {(cart) => (
            <div className="grid gap-4">
              <CartLines cart={cart} words={words} />
              <div className="grid gap-1 border-t border-border pt-3">
                <p className="flex items-baseline justify-between gap-3 text-lg font-semibold">
                  <span>{word(words, 'cart.subtotal')}</span>
                  <MoneyDisplay pesewas={cart.estimatedSubtotalPesewas} strong />
                </p>
                <p className="text-sm text-fg-muted">{word(words, 'cart.subtotalNote')}</p>
              </div>
            </div>
          )}
        </QueryBoundary>
      )}
    </Sheet>
  );
}

export function CartSheet(props: Parameters<typeof Drawer>[0]) {
  return (
    <ShopData>
      <Drawer {...props} />
    </ShopData>
  );
}
