'use client';

import type { ReactNode } from 'react';
import { UIProvider, type ThemePreference, type ToastLabels } from '@hakorem/ui';

/**
 * The storefront's one UIProvider (ADR 0006): theme, comfortable density, toasts and the themed portal for
 * the cart drawer. It is the only client boundary at the root, and takes its words as props from the server.
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
  return (
    <UIProvider theme={theme} density="comfortable" toastLabels={toastLabels}>
      {children}
    </UIProvider>
  );
}
