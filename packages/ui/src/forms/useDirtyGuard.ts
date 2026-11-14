'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DirtyGuard {
  /** True while a leave was requested on a dirty form and is waiting for the operator's answer. Open a confirm Dialog on it. */
  blocked: boolean;
  /**
   * Call from a router adapter before navigating. Clean: runs `proceed` now and
   * returns true. Dirty: holds `proceed`, sets `blocked`, and returns false.
   */
  requestLeave: (proceed: () => void) => boolean;
  /** The operator chose to leave: clears `blocked` and runs the held `proceed`. */
  confirmLeave: () => void;
  /** The operator chose to stay: clears `blocked` and drops the held `proceed`. */
  stay: () => void;
}

/**
 * useDirtyGuard. Router-agnostic: the router is not chosen yet (Next.js in the
 * storefront, a Vite router in the console), so wiring a specific router's
 * blocker to `requestLeave` is F1's job. This hook owns the two router-free
 * halves.
 *
 * - While `isDirty`, a `beforeunload` listener asks the browser to confirm
 *   closing or reloading the tab. Browsers show their own text and ignore any
 *   custom message, so there is none here. The listener is removed as soon as
 *   the form is clean or the component unmounts.
 * - `requestLeave`, `confirmLeave` and `stay` let an app's router adapter open
 *   a confirm Dialog ("Leave without saving?", strings from the app) for in-app
 *   navigation.
 *
 * Pass `form.formState.isDirty`. A successful Form submit resets the form to
 * the submitted values, so it is clean and leaving is not blocked.
 */
export function useDirtyGuard(isDirty: boolean): DirtyGuard {
  const [blocked, setBlocked] = useState(false);
  const held = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return true;
      }
      held.current = proceed;
      setBlocked(true);
      return false;
    },
    [isDirty],
  );

  const confirmLeave = useCallback(() => {
    const proceed = held.current;
    held.current = null;
    setBlocked(false);
    proceed?.();
  }, []);

  const stay = useCallback(() => {
    held.current = null;
    setBlocked(false);
  }, []);

  return { blocked, requestLeave, confirmLeave, stay };
}
