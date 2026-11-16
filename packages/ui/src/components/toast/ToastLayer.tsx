'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { ToastItem, type ToastInput } from './Toast';

export interface QueuedToast {
  id: string;
  toast: ToastInput;
}

export interface ToastLayerProps {
  toasts: readonly QueuedToast[];
  labels: { region: string; announcement: string; close: string };
  dismiss: (id: string) => void;
}

/**
 * The toast queue on screen, with Radix's provider and viewport (ADR 0006). UIProvider loads this module
 * the first time a toast is raised, and keeps it mounted from then on (ADR 0042), so a page that never
 * toasts never downloads Radix Toast. It renders inside UIProvider's themed portal target.
 */
export function ToastLayer({ toasts, labels, dismiss }: ToastLayerProps) {
  return (
    <ToastPrimitive.Provider label={labels.announcement} swipeDirection="right">
      {toasts.map(({ id, toast }) => (
        <ToastItem
          key={id}
          toast={toast}
          closeLabel={labels.close}
          open
          onOpenChange={(open) => {
            if (!open) dismiss(id);
          }}
        />
      ))}
      <ToastPrimitive.Viewport
        label={labels.region}
        className="fixed inset-x-0 bottom-0 z-toast m-0 flex list-none flex-col gap-2 p-3 outline-none sm:start-auto sm:w-[26rem]"
      />
    </ToastPrimitive.Provider>
  );
}
