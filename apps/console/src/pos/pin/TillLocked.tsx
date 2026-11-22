import { CloudUpload, LockKeyhole, LockOpen, LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Alert, Button, Field, Select } from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { getTill, useTill, type PinOutcome } from '../offline/till';
import { PinInput, PinOutcomeAlert } from './PinCheck';

/**
 * The locked till (OFFLINE_SYNC section 3, CR-032, ADR 0047, ADR 0057): only the shift's cashier's PIN opens
 * it, checked on the device, so it opens with no network. Selling and paying stop while it is locked; the
 * sale under it stays as it was. There is no plain sign-out here (owner, 2026-11-17): once the cashier's
 * PIN is locked, a supervisor's PIN signs the cashier out, and nothing else does. A locked PIN has no timer:
 * it opens again only with a new PIN (2.17.0); online, the till can ask the server.
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
  if (shift === null) return null;
  const till = getTill();
  const lockedOut = till.pinLocked(shift.cashierId);
  const canOpen = policy !== null && !lockedOut && !till.refusedVerifier(shift.cashierId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The field empties as the PIN is taken, so digits typed during the check are the next try's.
    const entered = pin;
    setPin('');
    setChecking(true);
    void getTill()
      .unlock(entered)
      .then(setOutcome)
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
      {canOpen ? (
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
      ) : lockedOut ? null : (
        <Alert severity="warning" title={t('lock.noPin', { name: shift.cashierName })} />
      )}
      {policy === null ? null : (
        <PinOutcomeAlert outcome={outcome} name={shift.cashierName} policy={policy} />
      )}
      {lockedOut ? <LockedOut name={shift.cashierName} /> : null}
      {/* The server takes a sign-out only once it holds the cashier's PIN locked (`CASHIER_NOT_LOCKED`). */}
      {lockedOut ? <SupervisorSignOut cashierName={shift.cashierName} /> : null}
    </section>
  );
}

/** A locked-out cashier: said in words, and online the till can ask the server whether it has ended. */
function LockedOut({ name }: { name: string }) {
  const { t } = useTranslation('pos');
  const online = useOnlineStatus();
  const [checking, setChecking] = useState(false);
  const [answer, setAnswer] = useState<'unreached' | 'still' | null>(null);
  return (
    <div className="grid gap-2" data-slot="locked-out">
      <Alert severity="critical" title={t('lock.server.title')}>
        {t('pin.lockedOut', { name })}
      </Alert>
      {online ? (
        <Button
          variant="secondary"
          loading={checking}
          loadingLabel={t('lock.server.checking')}
          onClick={() => {
            setChecking(true);
            void getTill()
              .reachServer()
              .then((reached) => setAnswer(reached ? 'still' : 'unreached'))
              .catch(() => setAnswer('unreached'))
              .finally(() => setChecking(false));
          }}
        >
          <CloudUpload aria-hidden="true" />
          {t('lock.server.check')}
        </Button>
      ) : (
        <p className="text-sm text-fg-muted">{t('lock.server.offline', { name })}</p>
      )}
      {answer === null ? null : (
        <p role="status" className="text-sm">
          {t(answer === 'still' ? 'lock.server.still' : 'lock.server.unreached', { name })}
        </p>
      )}
    </div>
  );
}

/**
 * Sign out the cashier, on a supervisor's PIN checked on the device as any PIN is (owner, 2026-11-17). It
 * does nothing but sign out, and is recorded with who did it and when. Without one, the cashier stays.
 */
function SupervisorSignOut({ cashierName }: { cashierName: string }) {
  const { t } = useTranslation('pos');
  const auth = useAuth();
  const navigate = useNavigate();
  const till = getTill();
  const { snapshot } = useTill();
  const supervisors = till.signOutSupervisors();
  const [who, setWho] = useState(supervisors[0]?.principalId ?? '');
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<PinOutcome | null>(null);
  const policy = snapshot?.localAuth?.policy ?? null;
  const person = supervisors.find((v) => v.principalId === who) ?? null;
  return (
    <section aria-labelledby="supervisor-title" className="grid gap-3 border-t border-border pt-4">
      <h3 id="supervisor-title" className="flex items-center gap-2 text-lg font-semibold">
        <LogOut aria-hidden="true" className="size-icon-md" />
        {t('lock.supervisor.title')}
      </h3>
      {supervisors.length === 0 || policy === null ? (
        <p className="text-sm">{t('lock.supervisor.none', { name: cashierName })}</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const entered = pin;
            setPin('');
            setChecking(true);
            void till
              .supervisorSignOut(who, entered)
              .then(async (result) => {
                setOutcome(result);
                if (result.kind !== 'ok') return;
                // The verifiers and the lock go with the cashier; the queue, the lockouts and the record stay.
                await Promise.all([till.forgetPins(), auth.logout()]);
                await navigate('/login', { replace: true });
              })
              .finally(() => setChecking(false));
          }}
        >
          <p className="text-sm">{t('lock.supervisor.body', { name: cashierName })}</p>
          <Field label={t('lock.supervisor.who')}>
            <Select
              value={who}
              onValueChange={(value) => {
                setWho(value);
                setOutcome(null);
              }}
              options={supervisors.map((v) => ({ value: v.principalId, label: v.displayName }))}
            />
          </Field>
          <PinInput value={pin} onChange={setPin} policy={policy} />
          <Button
            type="submit"
            variant="danger"
            disabled={person === null || pin === ''}
            loading={checking}
            loadingLabel={t('lock.supervisor.signingOut')}
          >
            <LogOut aria-hidden="true" />
            {t('lock.supervisor.submit', { name: cashierName })}
          </Button>
          <PinOutcomeAlert outcome={outcome} name={person?.displayName ?? ''} policy={policy} />
        </form>
      )}
    </section>
  );
}
