import { LockKeyhole, LockOpen } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@hakorem/ui';
import { getTill, useTill, type PinOutcome } from '../offline/till';
import { PinInput, PinOutcomeAlert } from './PinCheck';

/**
 * The locked till (OFFLINE_SYNC section 3, CR-032): only the shift's cashier's PIN opens it, checked on the
 * device, so it opens with no network. Selling, scanning and paying stop while it is locked; the sale under
 * it stays as it was. Sign-out stays in the header for a cashier who is locked out or not on this shift.
 */
export function TillLocked() {
  const { t } = useTranslation('pos');
  const { snapshot } = useTill();
  const heading = useRef<HTMLHeadingElement>(null);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<PinOutcome | null>(null);
  useEffect(() => heading.current?.focus(), []);
  const shift = snapshot?.shift ?? null;
  const policy = snapshot?.localAuth?.policy ?? null;
  if (shift === null || policy === null) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    void getTill()
      .unlock(pin)
      .then((result) => {
        setOutcome(result);
        setPin('');
      })
      .finally(() => setChecking(false));
  };

  return (
    <section
      aria-labelledby="locked-title"
      className="mx-auto grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-4"
      data-slot="till-locked"
    >
      <h2
        id="locked-title"
        ref={heading}
        tabIndex={-1}
        className="flex items-center gap-2 text-2xl font-bold"
      >
        <LockKeyhole aria-hidden="true" className="size-icon-lg" />
        {t('lock.title')}
      </h2>
      <p>{t('lock.body', { name: shift.cashierName })}</p>
      <form onSubmit={submit} className="grid gap-3">
        <PinInput value={pin} onChange={setPin} policy={policy} />
        <Button
          type="submit"
          size="lg"
          disabled={pin === ''}
          loading={checking}
          loadingLabel={t('lock.opening')}
        >
          <LockOpen aria-hidden="true" />
          {t('lock.open')}
        </Button>
      </form>
      <PinOutcomeAlert outcome={outcome} name={shift.cashierName} policy={policy} />
      <p className="text-sm text-fg-muted">{t('lock.signOut')}</p>
    </section>
  );
}
