import type { ComponentPropsWithRef } from 'react';

/**
 * An anchor for `asChild` tiles and rows in tests and stories. The tile slots its own content into it, so
 * at the call site the anchor looks empty; this keeps the lint rule's content check where it belongs.
 */
export function SlotLink({ children, ...props }: ComponentPropsWithRef<'a'>) {
  return <a {...props}>{children}</a>;
}
