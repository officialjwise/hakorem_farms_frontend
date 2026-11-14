'use client';

import { ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, Sheet } from '@hakorem/ui';

export interface CartDrawerLabels {
  open: string;
  title: string;
  close: string;
  emptyTitle: string;
  emptyBody: string;
  checkout: string;
  continueShopping: string;
}

/**
 * The cart drawer. It is a client component because it opens and closes. The cart itself (lines, totals) is
 * F7, and totals come from the API, never from here. Until then it is the empty state, with the way on to
 * checkout, so the route skeleton is reachable.
 */
export function CartDrawer({ labels, count }: { labels: CartDrawerLabels; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      side="end"
      open={open}
      onOpenChange={setOpen}
      title={labels.title}
      closeLabel={labels.close}
      trigger={
        <Button variant="secondary" aria-label={labels.open}>
          <ShoppingBasket aria-hidden="true" />
          <span aria-hidden="true">{count}</span>
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {labels.continueShopping}
          </Button>
          <Button asChild>
            <Link href="/checkout" onClick={() => setOpen(false)}>
              {labels.checkout}
            </Link>
          </Button>
        </>
      }
    >
      {count === 0 ? (
        <EmptyState compact title={labels.emptyTitle} description={labels.emptyBody} />
      ) : null}
    </Sheet>
  );
}
