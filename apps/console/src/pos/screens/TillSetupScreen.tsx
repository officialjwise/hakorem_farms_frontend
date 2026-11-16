import { MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, Field, Input, QueryBoundary, Select, formatDateTime } from '@hakorem/ui';
import { useApiAllPages, useApiMutation } from '../../data/api';
import { uniqueById, useIntentKey } from '../../lib/queries';
import { useStateLabels } from '../../lib/states';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { getTill, useTill } from '../offline/till';

/**
 * Setting a till up (OFFLINE_SYNC section 3): a manager chooses which register this device is and enrols
 * it (`enrolDevice`). The credential the API shows once is kept on the device and never shown (ADR 0044).
 * Online only. Permission: `pos.device.enrol` (the route's).
 */
export function TillSetupScreen() {
  const { t } = useTranslation('pos');
  const till = useTill();
  const device = till.snapshot?.device ?? null;

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h2 className="text-2xl font-bold">{t('setup.title')}</h2>
      {device !== null ? (
        <section
          aria-labelledby="enrolled-title"
          className="grid gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <h3 id="enrolled-title" className="text-lg font-semibold">
            {t('setup.enrolledTitle')}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>{t('setup.register')}</dt>
            <dd>
              {t('setup.registerName', { name: device.registerName, code: device.registerCode })}
            </dd>
            <dt>{t('setup.label')}</dt>
            <dd>{device.deviceLabel}</dd>
            <dt>{t('setup.enrolledAt')}</dt>
            <dd>{formatDateTime(device.enrolledAt)}</dd>
          </dl>
          <p className="text-sm text-fg-muted">{t('setup.enrolledBody')}</p>
          <Button asChild size="lg">
            <Link to="/pos">{t('setup.toSale')}</Link>
          </Button>
        </section>
      ) : (
        <Enrol />
      )}
    </div>
  );
}

function Enrol() {
  const { t } = useTranslation('pos');
  const registers = useApiAllPages('listRegisters', {});
  const enrol = useApiMutation('enrolDevice', {
    invalidates: ['listRegisterDevices', 'listRegisters'],
  });
  const keyFor = useIntentKey();
  const [registerId, setRegisterId] = useState('');
  const [label, setLabel] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);
  const labels = useStateLabels({
    loading: t('setup.loading'),
    emptyTitle: t('setup.noRegisters'),
    errorTitle: t('setup.registersFailed'),
    deniedTitle: t('setup.denied'),
  });
  const active = uniqueById(registers.data?.items ?? []).filter(
    (register) => register.status === 'ACTIVE',
  );
  const chosen = active.find((register) => register.id === registerId) ?? null;

  return (
    <QueryBoundary query={registers} labels={labels} isEmpty={() => active.length === 0}>
      {() => (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTried(true);
            if (chosen !== null && label.trim() !== '') {
              enrol.reset();
              setConfirming(true);
            }
          }}
        >
          <p>{t('setup.body')}</p>
          <Field
            label={t('setup.register')}
            error={tried && chosen === null ? t('setup.errors.register') : undefined}
          >
            <Select
              value={registerId}
              onValueChange={setRegisterId}
              placeholder={t('setup.registerPlaceholder')}
              options={active.map((register) => ({
                value: register.id,
                label: t('setup.registerOption', {
                  name: register.name,
                  code: register.code,
                  branch: register.branch.name,
                }),
              }))}
            />
          </Field>
          <Field
            label={t('setup.label')}
            hint={t('setup.labelHint')}
            error={tried && label.trim() === '' ? t('setup.errors.label') : undefined}
          >
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button type="submit" size="lg">
            <MonitorSmartphone aria-hidden="true" />
            {t('setup.review')}
          </Button>
          {chosen !== null ? (
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t('setup.confirmTitle')}
              body={t('setup.confirmBody', {
                name: chosen.name,
                code: chosen.code,
                label: label.trim(),
              })}
              consequence={t('setup.confirmConsequence')}
              confirmLabel={t('setup.enrol')}
              pendingLabel={t('setup.enrolling')}
              pending={enrol.isPending}
              error={enrol.error}
              failedTitle={t('setup.failed')}
              onConfirm={() => {
                const body = { deviceLabel: label.trim() };
                enrol
                  .mutateAsync(
                    { path: { id: chosen.id }, body },
                    { idempotencyKey: keyFor({ register: chosen.id, ...body }) },
                  )
                  .then(async (answer) => {
                    await getTill().enrol({
                      deviceId: answer.device.id,
                      deviceLabel: answer.device.deviceLabel,
                      registerId: chosen.id,
                      registerCode: chosen.code,
                      registerName: chosen.name,
                      branchId: chosen.branch.id,
                      credential: answer.deviceCredential,
                      enrolledAt: answer.device.enrolledAt,
                    });
                    setConfirming(false);
                  })
                  .catch(() => undefined);
              }}
            />
          ) : null}
        </form>
      )}
    </QueryBoundary>
  );
}
