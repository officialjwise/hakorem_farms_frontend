'use client';

import { lazy, Suspense } from 'react';
import type { CopyIdProps } from './CopyId';

/** CopyId and the Button it draws, loaded when a reference is first shown (as the toaster, ADR 0042). */
const CopyId = lazy(() => import('./CopyId').then((module) => ({ default: module.CopyId })));

/**
 * CopyId for ErrorState: a page that only might fail does not carry the copy button, `Button` and `cn` in
 * its first load. The storefront's listing pages render ErrorState on the server for their error state, so
 * a static CopyId put 2.8 kB gzipped on every one of them. Until it loads, the reference is shown as CopyId
 * shows it, without the button.
 */
export function LazyCopyId(props: CopyIdProps) {
  return (
    <Suspense
      fallback={
        <code className="min-w-0 font-mono font-semibold break-all text-fg">
          {props.shown ?? props.value}
        </code>
      }
    >
      <CopyId {...props} />
    </Suspense>
  );
}
