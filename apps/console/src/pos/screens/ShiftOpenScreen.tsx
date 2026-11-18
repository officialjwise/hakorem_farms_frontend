import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, EmptyState, Field, MoneyDisplay, MoneyInput, Skeleton } from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { RequestReference } from '../../lib/RequestReference';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { getTill, ShiftRefused, useTill } from '../offline/till';
import type { EntryFailure } from '../offline/types';

/**
 * Opening a shift with its float (FR-POS shift management, OFFLINE_SYNC section 10). The shift is made on
 * the till with its own id and queued, so it opens with the network off too, provided the till holds an
 * offline pack to sell from; online, the pack is downloaded for the new shift. The float is confirmed first.
 * Online it is sent at once (`openShift`, 2.5.0), and a refusal stays on this screen in words with its
 * reference: the till holds no shift then, so the cashier can put it right and open again.
 * Permission: `pos.shift.open` (the route's).
 */
export function ShiftOpenScreen() {
  const { t } = useTranslation(['posShift', 'pos']);
  const auth = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const till = useTill();
  const [float, setFloat] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<EntryFailure | null>(null);
  const [tried, setTried] = useState(false);
  const snapshot = till.snapshot;

  if (snapshot === null) return <Skeleton label={t('pos:sale.loading')} shape="block" />;
  if (snapshot.device === null) {
    return (
      <EmptyState
        title={t('pos:sale.noDevice.title')}
        description={t('pos:sale.noDevice.askManager')}
        action={
          <Button asChild variant="secondary">
            <Link to="/pos">{t('pos:toSale')}</Link>
          </Button>
        }
      />
    );
  }
  if (snapshot.shift !== null) {
    return (
      <EmptyState
        title={t('open.alreadyTitle', { name: snapshot.shift.cashierName })}
        description={t('open.alreadyBody')}
        action={
          <Button asChild>
            <Link to="/pos">{t('pos:toSale')}</Link>
          </Button>
        }
      />
    );
  }
  const noPackOffline = !online && snapshot.pack === null;

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h2 className="text-2xl font-bold">{t('open.title')}</h2>
      <p>{t('open.body', { register: snapshot.device.registerName })}</p>
      {noPackOffline ? <Alert severity="critical" title={t('open.noPackOffline')} /> : null}
      {!online && snapshot.pack !== null ? (
        <Alert severity="warning" title={t('open.offline')} />
      ) : null}
      {failed !== null && !confirming ? (
        <Alert severity="critical" title={t('open.failed')}>
          {failed.message}
          {failed.correlationId !== '' ? (
            <>
              {' '}
              {t('pos:referenceLabel')} <RequestReference value={failed.correlationId} />
            </>
          ) : null}
        </Alert>
      ) : null}
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTried(true);
          if (float !== null && !noPackOffline) {
            setFailed(null);
            setConfirming(true);
          }
        }}
      >
        <Field
          label={t('open.float')}
          hint={t('open.floatHint')}
          error={tried && float === null ? t('open.floatError') : undefined}
        >
          <MoneyInput value={float} onValueChange={setFloat} />
        </Field>
        <Button type="submit" size="lg" disabled={noPackOffline}>
          <Banknote aria-hidden="true" />
          {t('open.review')}
        </Button>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('open.confirmTitle')}
        body={t('open.confirmBody', { register: snapshot.device.registerName })}
        confirmLabel={t('open.confirm')}
        pendingLabel={t('open.opening')}
        pending={pending}
        error={failed === null ? null : { status: 0, ...failed }}
        failedTitle={t('open.failed')}
        onConfirm={() => {
          if (float === null || auth.session === null) return;
          setPending(true);
          const tillNow = getTill();
          tillNow
            .openShift({
              cashierId: auth.session.principal.id,
              cashierName: auth.session.principal.displayName,
              openingFloatPesewas: float,
            })
            .then(async () => {
              // A pack that fails to download is the sale screen's to say, with a way to try again.
              if (online) await tillNow.refreshPack().catch(() => undefined);
              setConfirming(false);
              navigate('/pos');
            })
            .catch((error: unknown) => {
              if (error instanceof ShiftRefused) {
                setFailed(error.failure);
                setConfirming(false);
              } else if (getTill().getState().snapshot?.shift === null) {
                const message = error instanceof Error ? error.message : String(error);
                setFailed({ code: 'TILL_STORE', message, correlationId: '' });
              } else {
                setConfirming(false);
              }
            })
            .finally(() => setPending(false));
        }}
      >
        <p className="flex items-baseline justify-between text-xl font-bold">
          <span>{t('open.float')}</span>
          <MoneyDisplay pesewas={float ?? 0} />
        </p>
      </ConfirmDialog>
    </div>
  );
}
