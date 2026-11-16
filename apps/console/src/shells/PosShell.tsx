import { CloudUpload, LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button, Dialog, DialogActions, Field, Input, StatusBadge } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { pendingCount } from '../pos/offline/sync';
import { getTill, hasTill, useTill } from '../pos/offline/till';
import { preloadTillScreens } from '../pos/routes';
import { emitScan } from '../pos/scans';
import { useBarcodeTrap } from '../pos/useBarcodeTrap';
import { OfflineBanner, OfflineIndicator } from './OfflineIndicator';

/**
 * The POS frame (ADR 0014): full screen, no sidebar, large touch targets, keyboard first. The barcode field
 * lives here, in the shell, so every POS screen built later inherits the focus trap and cannot forget it.
 */
export function PosShell() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const navigate = useNavigate();
  const barcode = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const till = useTill();
  useBarcodeTrap(barcode);
  const waiting = till.snapshot === null ? 0 : pendingCount(till.snapshot);
  const device = till.snapshot?.device ?? null;
  const shift = till.snapshot?.shift ?? null;

  // The queue is sent as soon as the browser says the network is back (OFFLINE_SYNC 6.4), and the till's
  // other screens are fetched while it has one, so they open offline later (ADR 0043).
  useEffect(() => {
    if (!hasTill()) return undefined;
    const online = () => getTill().online();
    window.addEventListener('online', online);
    void preloadTillScreens();
    return () => window.removeEventListener('online', online);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = value.trim();
    if (code === '') return;
    // The screen under the bar decides what the code is (the sale screen looks it up in the offline pack).
    setLastScan(code);
    emitScan(code);
    setValue('');
  };

  const signOut = async () => {
    setConfirmOpen(false);
    await auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div data-shell="pos" className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 print:hidden">
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
          <Button asChild variant="secondary" size="lg">
            <Link to="/">{t('pos.backOffice')}</Link>
          </Button>
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
        </div>
      </header>
      <nav
        aria-label={t('pos.navLabel')}
        className="flex flex-wrap gap-2 border-b border-border bg-surface px-4 py-2 print:hidden"
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
      <div className="print:hidden">
        <OfflineBanner />
      </div>
      <form
        onSubmit={submit}
        className="border-b border-border bg-surface-sunken p-4 print:hidden"
        data-slot="barcode-bar"
      >
        <Field label={t('pos.barcode')} hint={t('pos.barcodeHint')}>
          <Input
            ref={barcode}
            size="lg"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
          />
        </Field>
        <p className="mt-2 text-sm text-fg-muted" aria-live="polite" data-slot="last-scan">
          {lastScan === null ? t('pos.scannedNone') : t('pos.scanned', { code: lastScan })}
        </p>
      </form>
      <main id="main" className="min-w-0 flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
