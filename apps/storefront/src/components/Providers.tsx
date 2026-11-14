'use client';

import { useState, type ReactNode } from 'react';
import { createQueryClient, QueryClientProvider } from '@hakorem/data';
import { UIProvider, type ThemePreference, type ToastLabels } from '@hakorem/ui';

/**
 * The storefront's one UIProvider (ADR 0006): theme, comfortable density, toasts and the themed portal for
 * the cart drawer. It is the only client boundary at the root, and takes its words as props from the server.
 *
 * It also mounts the one QueryClientProvider (ADR 0022), beside UIProvider. The client is created per
 * mount, not once per module, because this component also renders on the server and a module-level
 * client would be shared between visitors.
 */
export function Providers({
  theme,
  toastLabels,
  children,
}: {
  theme: ThemePreference;
  toastLabels: ToastLabels;
  children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider theme={theme} density="comfortable" toastLabels={toastLabels}>
        {children}
      </UIProvider>
    </QueryClientProvider>
  );
}
