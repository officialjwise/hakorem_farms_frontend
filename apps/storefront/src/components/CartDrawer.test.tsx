import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { UIProvider } from '@hakorem/ui';
import { CartDrawer } from './CartDrawer';

const labels = {
  open: 'Cart, 0 items',
  title: 'Your cart',
  close: 'Close cart',
  emptyTitle: 'Your cart is empty',
  emptyBody: 'Add something from the shop.',
  checkout: 'Go to checkout',
  continueShopping: 'Keep shopping',
};

function Root({ children }: { children: ReactNode }) {
  return (
    <UIProvider
      theme="light"
      density="comfortable"
      toastLabels={{ region: 'Notifications', announcement: 'Notification', close: 'Dismiss' }}
    >
      {children}
    </UIProvider>
  );
}

describe('cart drawer', () => {
  it('closed: only the trigger, named with the count', () => {
    render(<CartDrawer labels={labels} count={0} />, { wrapper: Root });
    expect(screen.getByRole('button', { name: 'Cart, 0 items' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open and empty: says so in words and offers the way on to checkout', async () => {
    render(<CartDrawer labels={labels} count={0} />, { wrapper: Root });
    await userEvent.click(await screen.findByRole('button', { name: 'Cart, 0 items' }));
    const drawer = await screen.findByRole('dialog', { name: 'Your cart' });
    expect(drawer).toHaveTextContent('Your cart is empty');
    expect(screen.getByRole('link', { name: 'Go to checkout' })).toHaveAttribute(
      'href',
      '/checkout',
    );
  });

  it('keyboard: Escape closes it and focus returns to the trigger', async () => {
    render(<CartDrawer labels={labels} count={0} />, { wrapper: Root });
    const trigger = await screen.findByRole('button', { name: 'Cart, 0 items' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
