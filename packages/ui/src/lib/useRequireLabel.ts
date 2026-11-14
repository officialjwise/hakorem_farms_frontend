import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { useEffect, useRef, type Ref } from 'react';

type Labelable = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null };

/**
 * ADR 0005: a control used outside a Field is a review blocker, so make it hard
 * to do by accident. After mount, the control must have a name from a
 * `<label>` (which Field wires), `aria-label` or `aria-labelledby`. A
 * placeholder is never a label. Throws otherwise, the same stance as
 * StatusBadge's empty label.
 *
 * Returns a ref to give the control; the caller's own ref is composed in.
 */
export function useRequireLabel<T extends Labelable>(component: string, forwarded?: Ref<T>) {
  const own = useRef<T | null>(null);
  const ref = useComposedRefs(own, forwarded);

  useEffect(() => {
    const el = own.current;
    if (el === null) return;
    const named =
      (el.getAttribute('aria-label') ?? '').trim() !== '' ||
      (el.getAttribute('aria-labelledby') ?? '').trim() !== '' ||
      (el.labels?.length ?? 0) > 0;
    if (!named) {
      throw new Error(
        `${component} has no label. Put it inside a Field (ADR 0005), or give it an aria-label. A placeholder is never a label.`,
      );
    }
  });

  return ref;
}
