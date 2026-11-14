import { LogOut } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';
import { Button, Dialog, Field, Input } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
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
  useBarcodeTrap(barcode);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = value.trim();
    if (code === '') return;
    // Looking the item up and adding it to a sale is F9. The shell only proves the scan landed.
    setLastScan(code);
    setValue('');
  };

  const signOut = async () => {
    setConfirmOpen(false);
    await auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div data-shell="pos" className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <h1 className="text-xl font-semibold">{t('pos.title')}</h1>
        <OfflineIndicator />
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="secondary" size="lg">
            <Link to="/">{t('pos.backOffice')}</Link>
          </Button>
          <Dialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={t('pos.signOutTitle')}
            description={t('pos.signOutBody')}
            closeLabel={t('pos.close')}
            trigger={
              <Button variant="secondary" size="lg">
                <LogOut aria-hidden="true" />
                {t('pos.signOut')}
              </Button>
            }
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                  {t('pos.cancel')}
                </Button>
                <Button variant="danger" onClick={() => void signOut()}>
                  {t('pos.signOutConfirm')}
                </Button>
              </>
            }
          />
        </div>
      </header>
      <OfflineBanner />
      <form
        onSubmit={submit}
        className="border-b border-border bg-surface-sunken p-4"
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
