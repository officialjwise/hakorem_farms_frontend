import { CloudUpload, LockKeyhole, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Alert, Button, Dialog, DialogActions, StatusBadge } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { pendingCount } from '../pos/offline/sync';
import { getTill, hasTill, useTill } from '../pos/offline/till';
import { LazySetTillPin, LazyTillLocked } from '../pos/parts';
import { preloadTillScreens } from '../pos/routes';
import { OfflineBanner, OfflineIndicator } from './OfflineIndicator';

/**
 * The POS frame: full screen, no sidebar, large touch targets. Items are found by tapping and searching on
 * the sale screen; there is no barcode field and no focus trap (owner, 2026-11-17, ADR 0048, superseding
 * ADR 0014).
 */
export function PosShell() {
  const { t, i18n } = useTranslation(['shell', 'pos']);
  const auth = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const till = useTill();
  // Locked until the cashier's PIN opens it or a supervisor signs them out, whatever the verifiers now
  // say (owner, 2026-11-17).
  const locked = till.snapshot?.meta.locked === true && hasTill();
  const refused = till.snapshot?.localAuth?.refused ?? [];
  const waiting = till.snapshot === null ? 0 : pendingCount(till.snapshot);
  const device = till.snapshot?.device ?? null;
  const shift = till.snapshot?.shift ?? null;
  const canLock = till.snapshot !== null && hasTill() && getTill().canLock();
  const idleSeconds = till.snapshot?.localAuth?.policy.idleLockSeconds ?? null;

  // The till locks itself after the policy's time with no touch, scan or key (CR-032).
  useEffect(() => {
    if (!canLock || locked || idleSeconds === null || idleSeconds <= 0) return undefined;
    let timer = setTimeout(() => void getTill().lock(), idleSeconds * 1000);
    const touched = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void getTill().lock(), idleSeconds * 1000);
    };
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((name) => document.addEventListener(name, touched, true));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => document.removeEventListener(name, touched, true));
    };
  }, [canLock, locked, idleSeconds]);

  // The queue is sent as soon as the browser says the network is back (OFFLINE_SYNC 6.4), and the till's
  // other screens are fetched while it has one, so they open offline later (ADR 0043).
  useEffect(() => {
    if (!hasTill()) return undefined;
    const online = () => getTill().online();
    window.addEventListener('online', online);
    void preloadTillScreens(i18n);
    return () => window.removeEventListener('online', online);
  }, [i18n]);

  const signOut = async () => {
    setConfirmOpen(false);
    // The PIN verifiers and the lock go with the cashier (OFFLINE_SYNC section 3); the queue stays. The
    // sign-out request starts at once, beside the store write, as it did before there were PINs.
    await Promise.all([hasTill() ? getTill().forgetPins() : Promise.resolve(), auth.logout()]);
    navigate('/login', { replace: true });
  };

  return (
    <div data-shell="pos" className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <h1 className="text-xl font-semibold">{t('pos.title')}</h1>
        <OfflineIndicator />
        <Link to="/pos/queue" data-slot="queue-count" className="rounded-md">
          {waiting === 0 ? (
            <StatusBadge tone="good" icon={CloudUpload} label={t('pos.allSent')} />
          ) : (
            <StatusBadge
              tone="warning"
              icon={CloudUpload}
              label={t('pos.waiting', { count: waiting })}
            />
          )}
        </Link>
        {device !== null ? (
          <p className="text-sm text-fg-muted" data-slot="till-name">
            {shift !== null
              ? t('pos.tillShift', { register: device.registerName, cashier: shift.cashierName })
              : t('pos.till', { register: device.registerName })}
          </p>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {/* One's own till PIN, set with the server: never on a locked till (ADR 0057). */}
          {device !== null && !locked && auth.session !== null && auth.can('pos.pin.set') ? (
            <LazySetTillPin principalId={auth.session.principal.id} />
          ) : null}
          {canLock && !locked ? (
            <Button variant="secondary" size="lg" onClick={() => void getTill().lock()}>
              <LockKeyhole aria-hidden="true" />
              {t('pos.lock')}
            </Button>
          ) : null}
          {locked ? null : (
            <Button asChild variant="secondary" size="lg">
              <Link to="/">{t('pos.backOffice')}</Link>
            </Button>
          )}
          {/* On a locked till only a supervisor's PIN signs the cashier out (the lock screen). */}
          {locked ? null : (
            <Dialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t('pos.signOutTitle')}
              description={
                waiting > 0 ? t('pos.signOutWaiting', { count: waiting }) : t('pos.signOutBody')
              }
              closeLabel={t('pos.close')}
              icon={LogOut}
              iconTone="critical"
              trigger={
                <Button variant="secondary" size="lg">
                  <LogOut aria-hidden="true" />
                  {t('pos.signOut')}
                </Button>
              }
              footer={
                <DialogActions cancelLabel={t('pos.cancel')} onCancel={() => setConfirmOpen(false)}>
                  <Button variant="danger" onClick={() => void signOut()}>
                    <LogOut aria-hidden="true" />
                    {t('pos.signOutConfirm')}
                  </Button>
                </DialogActions>
              }
            />
          )}
        </div>
      </header>
      {refused.length === 0 ? null : (
        <div className="px-4 pt-3" data-slot="pin-refused">
          <Alert
            severity="warning"
            title={t('pos:pin.refused', { names: refused.map((r) => r.displayName).join(', ') })}
          />
        </div>
      )}
      {locked ? (
        <div className="p-4">
          <LazyTillLocked />
        </div>
      ) : null}
      <nav
        hidden={locked}
        aria-label={t('pos.navLabel')}
        className="flex flex-wrap gap-2 border-b border-border bg-surface px-4 py-2"
      >
        {(
          [
            ['/pos', 'pos.nav.sale', 'pos.sale.create'],
            ['/pos/shift', 'pos.nav.shift', 'pos.sale.create'],
            ['/pos/queue', 'pos.nav.queue', 'pos.sale.create'],
            ['/pos/returns', 'pos.nav.returns', 'ord.return.create'],
            ['/pos/setup', 'pos.nav.setup', 'pos.device.enrol'],
          ] as const
        )
          .filter(([, , permission]) => auth.can(permission))
          .map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end
              className="rounded-md px-3 py-2 font-semibold text-fg hover:bg-surface-hover aria-[current=page]:bg-accent-subtle aria-[current=page]:underline"
            >
              {t(label)}
            </NavLink>
          ))}
      </nav>
      <OfflineBanner />
      {/* Kept mounted while locked, so a sale under way is as it was when the till opens again. */}
      <main id="main" hidden={locked} className="min-w-0 flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
