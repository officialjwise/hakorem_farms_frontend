import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiError } from '@hakorem/api-client';
import { Alert, Button, Dialog, DialogActions } from '@hakorem/ui';
import { newRecordId } from '../../lib/clientId';
import { RequestReference } from '../../lib/RequestReference';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { getTill, useTill } from '../offline/till';
import { PinInput } from './PinCheck';
import { pinShapeOk, tillPolicy } from './pin';

/**
 * The signed-in person sets their own till PIN (`setTillPin`, 2.17.0, ADR 0057). The till derives the
 * verifier from the PIN typed twice and sends only that; the server makes it the next version, which
 * replaces the last on every till and ends a lockout. It needs the server, so it is offered online only,
 * and never on a locked till: a PIN set there would open it for whoever is standing at it.
 */
export function SetTillPin({ principalId }: { principalId: string }) {
  const { t } = useTranslation('pos');
  const online = useOnlineStatus();
  const { snapshot } = useTill();
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState('');
  const [again, setAgain] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  // One intent per opening of the dialog: a resend of the same PIN is the same request.
  const [intent, setIntent] = useState(() => newRecordId());
  const policy = tillPolicy(undefined);
  const hasPin = snapshot?.localAuth?.verifiers.some((v) => v.principalId === principalId) ?? false;

  const reset = () => {
    setFirst('');
    setAgain('');
    setMismatch(false);
    setFailure(null);
    setDone(false);
    setIntent(newRecordId());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (first !== again) {
      setMismatch(true);
      setAgain('');
      return;
    }
    setMismatch(false);
    setFailure(null);
    setSaving(true);
    void getTill()
      .setOwnPin(first, intent)
      .then((result) => {
        if (result === 'not-a-pin') return;
        setDone(true);
        setFirst('');
        setAgain('');
      })
      .catch((error: unknown) => setFailure(error as ApiError))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) reset();
        setOpen(next);
      }}
      title={t('pin.set.title')}
      description={t('pin.set.body')}
      closeLabel={t('close')}
      icon={KeyRound}
      trigger={
        <Button variant="secondary" size="lg" data-slot="set-till-pin">
          <KeyRound aria-hidden="true" />
          {hasPin ? t('pin.set.change') : t('pin.set.open')}
        </Button>
      }
      footer={
        done ? (
          <Button onClick={() => setOpen(false)}>{t('close')}</Button>
        ) : (
          <DialogActions cancelLabel={t('cancel')} onCancel={() => setOpen(false)}>
            <Button
              type="submit"
              form="set-till-pin"
              disabled={!online || first === '' || again === ''}
              loading={saving}
              loadingLabel={t('pin.set.setting')}
            >
              {t('pin.set.submit')}
            </Button>
          </DialogActions>
        )
      }
    >
      {done ? (
        <Alert severity="good" title={t('pin.set.done')} />
      ) : (
        <form id="set-till-pin" onSubmit={submit} className="grid gap-3">
          <p className="text-sm">{t('pin.set.replaces')}</p>
          {online ? null : <Alert severity="warning" title={t('pin.set.offline')} />}
          <PinInput value={first} onChange={setFirst} policy={policy} label={t('pin.set.first')} />
          <PinInput value={again} onChange={setAgain} policy={policy} label={t('pin.set.again')} />
          {mismatch ? <Alert severity="critical" title={t('pin.set.mismatch')} /> : null}
          {first !== '' && again !== '' && first === again && !pinShapeOk(first, policy) ? (
            <Alert
              severity="critical"
              title={t('pin.notAPin', { min: policy.minDigits, max: policy.maxDigits })}
            />
          ) : null}
          {failure === null ? null : (
            <Alert severity="critical" title={t('pin.set.failed')}>
              {failure.message}{' '}
              {failure.correlationId ? <RequestReference value={failure.correlationId} /> : null}
            </Alert>
          )}
        </form>
      )}
    </Dialog>
  );
}
