import type { ReactNode } from 'react';
import { Providers } from './components/Providers';

/** The storefront's root providers, as the layout mounts them, for a test that renders a client leaf. */
export function Root({ children }: { children: ReactNode }) {
  return (
    <Providers
      theme="light"
      toastLabels={{ region: 'Notifications', announcement: 'Notification', close: 'Dismiss' }}
    >
      {children}
    </Providers>
  );
}
