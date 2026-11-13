import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubResizeObserver } from '../../test/stubResizeObserver';
import { toastLabels } from '../../test/toastLabels';
import { UIProvider, useToast } from '../ui-provider/UIProvider';
import type { ToastInput } from './Toast';

stubResizeObserver();

let lastId = '';
const holder: { api: ReturnType<typeof useToast> | null } = { api: null };

function Capture() {
  const toast = useToast();
  useEffect(() => {
    holder.api = toast;
  }, [toast]);
  return null;
}

function setup() {
  return render(
    <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
      <Capture />
      <p>App</p>
    </UIProvider>,
  );
}

function show(toast: ToastInput) {
  act(() => {
    lastId = holder.api?.show(toast) ?? '';
  });
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast with its title, description and tone, inside the themed portal', async () => {
    setup();
    show({ tone: 'good', title: 'Sale saved', description: 'Receipt GH-0042' });
    const title = await screen.findByText('Sale saved');
    const toast = title.closest('[data-slot="toast"]');
    expect(toast).toHaveAttribute('data-tone', 'good');
    expect(toast).toHaveTextContent('Receipt GH-0042');
    expect(toast?.closest('[data-slot="ui-portal"]')).toHaveAttribute('data-theme', 'dark');
  });

  it('names the close button and the region from the supplied labels', async () => {
    setup();
    show({ tone: 'info', title: 'Receipt sent' });
    await screen.findByText('Receipt sent');
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^Notifications/ })).toBeInTheDocument();
  });

  it('dismisses with the close button', async () => {
    setup();
    show({ tone: 'info', title: 'Receipt sent' });
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Receipt sent')).toBeNull();
  });

  it('dismisses by id', async () => {
    setup();
    show({ tone: 'info', title: 'Receipt sent' });
    await screen.findByText('Receipt sent');
    act(() => holder.api?.dismiss(lastId));
    expect(screen.queryByText('Receipt sent')).toBeNull();
  });

  it('queues several toasts', async () => {
    setup();
    show({ tone: 'info', title: 'One' });
    show({ tone: 'good', title: 'Two' });
    expect(await screen.findByText('One')).toBeInTheDocument();
    expect(await screen.findByText('Two')).toBeInTheDocument();
  });

  it('auto-dismisses a good toast after six seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    show({ tone: 'good', title: 'Sale saved' });
    await screen.findByText('Sale saved');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(screen.queryByText('Sale saved')).toBeNull();
  });

  it('keeps a persistent good toast on screen', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    show({ tone: 'good', title: 'Sale saved', persistent: true });
    await screen.findByText('Sale saved');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(screen.getByText('Sale saved')).toBeInTheDocument();
  });

  it.each(['critical', 'warning'] as const)('never auto-dismisses a %s toast', async (tone) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    show({ tone, title: 'Payment not confirmed' });
    await screen.findByText('Payment not confirmed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(screen.getByText('Payment not confirmed')).toBeInTheDocument();
  });

  it('runs a toast action', async () => {
    const onAction = vi.fn();
    setup();
    show({ tone: 'info', title: 'Item removed', action: { label: 'Undo', onAction } });
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('throws on a blank title rather than render colour alone', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup();
    expect(() => show({ tone: 'good', title: '  ' })).toThrow(/title/);
    quiet.mockRestore();
  });
});
