'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@hakorem/data';
import { shopQueryClient } from '../lib/browserApi';

/**
 * Mounts the storefront's one QueryClient around an island that uses the basket (ADR 0041). It is imported
 * only by those islands, so the data layer's code loads with them and not with every page.
 */
export function ShopData({ children }: { children: ReactNode }) {
  const [client] = useState(shopQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
