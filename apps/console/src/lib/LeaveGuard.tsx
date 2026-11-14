import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { Button, Dialog, useDirtyGuard } from '@hakorem/ui';

export interface LeaveGuard {
  open: boolean;
  leave: () => void;
  stay: () => void;
}

/**
 * The dirty-state guard on navigation (F0's `useDirtyGuard`), wired to React Router's `useBlocker`. This is
 * the router adapter `useDirtyGuard` was built to receive (an F2 carry, ADR 0011).
 *
 * - **Leaving the tab** (close, reload, typed address): `useDirtyGuard`'s `beforeunload` asks the browser.
 * - **Leaving inside the app** (a link, Back, a breadcrumb): the blocker holds the navigation while the
 *   form is dirty, and `LeaveGuardDialog` asks. "Leave" lets it through; "Stay" drops it.
 *
 * A change of search parameters on the same page is not a leave. Pass `form.formState.isDirty`: a successful
 * submit resets the form, so it is clean and the navigation that follows is not blocked.
 */
export function useLeaveGuard(isDirty: boolean): LeaveGuard {
  const guard = useDirtyGuard(isDirty);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const { requestLeave } = guard;

  useEffect(() => {
    if (blocker.state === 'blocked') requestLeave(() => blocker.proceed());
  }, [blocker, requestLeave]);

  return {
    open: guard.blocked,
    leave: guard.confirmLeave,
    stay: () => {
      guard.stay();
      if (blocker.state === 'blocked') blocker.reset();
    },
  };
}

/** "Leave without saving?" The keyboard default is Stay: it is the first button and takes focus. */
export function LeaveGuardDialog({ guard }: { guard: LeaveGuard }) {
  const { t } = useTranslation('common');
  return (
    <Dialog
      open={guard.open}
      onOpenChange={(open) => {
        if (!open) guard.stay();
      }}
      title={t('dirty.title')}
      description={t('dirty.body')}
      closeLabel={t('actions.close')}
    >
      <div className="flex flex-wrap justify-end gap-2 pb-2">
        <Button variant="secondary" onClick={guard.stay}>
          {t('dirty.stay')}
        </Button>
        <Button variant="danger" onClick={guard.leave}>
          {t('dirty.leave')}
        </Button>
      </div>
    </Dialog>
  );
}
